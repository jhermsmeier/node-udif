import * as adc from 'apple-data-compression';
import { promises as fs, createReadStream as CRS } from 'fs';
import { Readable, PassThrough } from 'stream';
import * as bz2 from 'unbzip2-stream';
import * as zlib from 'zlib';

import { BLOCK } from './constants';
import { Image } from './image';

export async function withOpenImage<T>(
	filePath: string,
	fn: (image: Image) => Promise<T>,
): Promise<T> {
	const handle = await fs.open(filePath, 'r');
	try {
		const image = new Image({
			size: (await handle.stat()).size,
			createReadStream: async (start = 0, end = Infinity) => {
				return CRS('', { fd: handle.fd, autoClose: false, start, end });
			},
		});
		await image.ready;
		return await fn(image);
	} finally {
		await handle.close();
	}
}

export function* blockGenerator(image: Image, exclude: BLOCK[] = []) {
	for (const entry of image.resourceFork.blkx) {
		for (const block of entry.map.blocks) {
			if (!exclude.includes(block.type)) {
				yield { entry, block };
			}
		}
	}
}

export function blockDecompressor(
	type: BLOCK,
	inputStream: NodeJS.ReadableStream,
): NodeJS.ReadableStream {
	if (type === BLOCK.RAW) {
		return inputStream;
	} else if (type === BLOCK.UDZO) {
		return inputStream.pipe(zlib.createInflate());
	} else if (type === BLOCK.UDBZ) {
		// unbzip2-stream is not async iterable, so we pipe it through a PassThrough
		return inputStream.pipe(bz2()).pipe(new PassThrough());
	} else if (type === BLOCK.UDCO) {
		return inputStream.pipe(new adc.Decompressor());
	} else if (type === BLOCK.LZFSE) {
		throw new Error('Unsupported compression method: LZFSE');
	}
	throw new Error(
		`Unknown compression method for type "0x${type.toString(16)}"`,
	);
}

export class ZeroStream extends Readable {
	private blank: Buffer;

	constructor(private length = Infinity, blank?: Buffer) {
		super();
		this.blank = blank ?? Buffer.alloc(64 * 1024);
	}

	public _read() {
		if (this.length >= this.blank.length) {
			this.push(this.blank);
			this.length -= this.blank.length;
		} else if (this.length > 0) {
			this.push(this.blank.slice(0, this.length));
			this.length = 0;
		} else {
			this.push(null);
		}
	}
}

export function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
	const chunks: Buffer[] = [];
	return new Promise((resolve, reject) => {
		stream.on('data', (buf: Buffer) => {
			chunks.push(buf);
		});
		stream.on('end', () => {
			resolve(Buffer.concat(chunks));
		});
		stream.on('error', reject);
	});
}
