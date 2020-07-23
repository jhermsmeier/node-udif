import { ReadableOptions } from 'stream';

import { BLOCK, SECTOR_SIZE } from './constants';
import { Image } from './image';
import { ReadStream } from './readstream';
import { decompressBlock } from './utils';

export class SparseReadStream extends ReadStream {
	// Don't read comments or block map terminators
	// Ignore zerofill & free, since this is a sparse stream
	// TODO: maybe ZEROFILL should not be ignored
	protected static readonly exclude = [
		BLOCK.COMMENT,
		BLOCK.TERMINATOR,
		BLOCK.ZEROFILL,
		BLOCK.FREE,
	];

	/** UDIF Image SparseReadStream */
	constructor(image: Image, options: ReadableOptions = {}) {
		super(image, { objectMode: true, ...options });
	}

	protected async __read(): Promise<void> {
		const { value, done } = this.blockIterator.next();
		if (done) {
			this.push(null);
			return;
		}
		const { entry, block } = value;
		const position = this.image.footer!.dataForkOffset + block.compressedOffset;
		const length = block.compressedLength;
		await this.image.fs.read(this.blockBuffer, 0, length, position);
		const slice = this.blockBuffer.slice(0, length);
		const buffer =
			block.type === BLOCK.RAW
				? Buffer.from(slice)
				: decompressBlock(block.type, slice);
		const chunkPosition =
			entry.map.sectorNumber * SECTOR_SIZE + block.sectorNumber * SECTOR_SIZE;
		this.push({ buffer, position: chunkPosition });
		this.bytesRead += buffer.length;
	}
}
