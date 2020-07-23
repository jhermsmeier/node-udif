import * as adc from 'apple-data-compression';
import { promises as fs, createReadStream as CRS } from 'fs';
import * as bunzip from 'seek-bzip';
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
			read: handle.read.bind(handle),
			createReadStream: async (start = 0, end = Infinity) =>
				CRS('', { fd: handle.fd, start, end }),
		});
		await image.ready;
		return await fn(image);
	} finally {
		await handle.close();
	}
}

/** Decompress an image block */
export function decompressBlock(type: BLOCK, buffer: Buffer): Buffer {
	switch (type) {
		case BLOCK.UDZO:
			return zlib.inflateSync(buffer);
			break;
		case BLOCK.UDBZ:
			return bunzip.decode(buffer);
			break;
		case BLOCK.UDCO:
			return adc.decompress(buffer);
			break;
		case BLOCK.LZFSE:
			throw new Error('Unsupported compression method: LZFSE');
			break;
		default:
			throw new Error(
				`Unknown compression method for type "0x${type.toString(16)}"`,
			);
			break;
	}
}
