import { Readable, ReadableOptions } from 'stream';

import { Block } from './block';
import { BLOCK, SECTOR_SIZE } from './constants';
import { Image, InternalEntry } from './image';
import { decompressBlock } from './utils';

export class ReadStream extends Readable {
	public bytesRead = 0;

	protected readonly blockBuffer = Buffer.allocUnsafe(2 * 1024 * 1024);
	protected readonly blockIterator: Generator<{
		entry: InternalEntry;
		block: Block;
	}>;
	// Don't read comments or block map terminators
	protected static readonly exclude: BLOCK[] = [
		BLOCK.COMMENT,
		BLOCK.TERMINATOR,
	];

	/** UDIF Image ReadStream */
	constructor(public readonly image: Image, options: ReadableOptions) {
		super(options);
		this.blockIterator = this.blockGenerator(
			(this.constructor as typeof ReadStream).exclude,
		);
	}

	public *blockGenerator(exclude: BLOCK[] = []) {
		for (const entry of this.image.resourceFork.blkx) {
			for (const block of entry.map.blocks) {
				if (!exclude.includes(block.type)) {
					yield { entry, block };
				}
			}
		}
	}

	public async _read(): Promise<void> {
		try {
			await this.__read();
		} catch (error) {
			this.emit('error', error);
		}
	}

	protected async __read(): Promise<void> {
		const { value, done } = this.blockIterator.next();
		if (done) {
			this.push(null);
			return;
		}
		const { block } = value;
		// Zerofill
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			const size = block.sectorCount * SECTOR_SIZE;
			this.push(Buffer.alloc(size, 0));
			this.bytesRead += size;
			return;
		}
		const position = this.image.footer!.dataForkOffset + block.compressedOffset;
		const length = block.compressedLength;
		await this.image.fs.read(this.blockBuffer, 0, length, position);
		const slice = this.blockBuffer.slice(0, length);
		const buffer =
			block.type === BLOCK.RAW
				? Buffer.from(slice)
				: decompressBlock(block.type, slice);
		this.push(buffer);
		this.bytesRead += buffer.length;
	}
}
