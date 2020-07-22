import { ReadableOptions } from 'stream';

import { Image } from './image';
import { ReadStream } from './readstream';
import { decompressBlock, BLOCK, SECTOR_SIZE } from './';

export class SparseReadStream extends ReadStream {
	_blockBuffer = Buffer.allocUnsafe(2 * 1024 * 1024);

	/** UDIF Image SparseReadStream */
	constructor(image: Image, options: ReadableOptions = {}) {
		super(image, { objectMode: true, ...options });
	}

	protected async __read(): Promise<void> {
		const blkx = this.image.resourceFork.blkx;
		const entry = blkx[this._entry];

		if (entry == null) {
			this.push(null);
			return;
		}

		const block = entry.map.blocks[this._block];
		if (block == null) {
			this._entry++;
			this._block = 0;
			this.__read();
			return;
		}

		// Don't read comments or block map terminators
		if (block.type === BLOCK.COMMENT || block.type === BLOCK.TERMINATOR) {
			this._block++;
			this.__read();
			return;
		}

		// Ignore zerofill & free, since this is a sparse stream
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			this._block++;
			this.__read();
			return;
		}

		const position = this.image.footer!.dataForkOffset + block.compressedOffset;
		const length = block.compressedLength;
		const offset = 0;

		const { bytesRead } = await this.image.fs.read(
			this._blockBuffer,
			offset,
			length,
			position,
		);
		this._block++;
		this.bytesRead += bytesRead;

		// TODO: factorize
		if (bytesRead !== length) {
			throw new Error(
				`Bytes read mismatch, expected ${length}, got ${bytesRead}`,
			);
		}

		const chunkPosition =
			entry.map.sectorNumber * SECTOR_SIZE + block.sectorNumber * SECTOR_SIZE;

		if (block.type !== BLOCK.RAW) {
			const buffer = decompressBlock(block.type, this._blockBuffer, length);
			this.bytesWritten += buffer.length;
			this.push({ buffer, position: chunkPosition });
		} else {
			this.bytesWritten += length;
			const buffer = Buffer.allocUnsafe(length);
			this._blockBuffer.copy(buffer);
			this.push({ buffer, position: chunkPosition });
		}
	}
}
