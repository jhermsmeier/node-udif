import { Readable, ReadableOptions } from 'stream';

import { BLOCK, SECTOR_SIZE } from './constants';
import { Image } from './image';
import { decompressBlock } from './utils';

export class ReadStream extends Readable {
	bytesRead = 0;
	bytesWritten = 0;
	_entry = 0;
	_block = 0;
	_toRead: number | null = null;
	_blockBuffer = Buffer.allocUnsafe(2 * 1024 * 1024);

	/** UDIF Image ReadStream */
	constructor(public readonly image: Image, options: ReadableOptions) {
		super(options);
	}

	public async _read(): Promise<void> {
		try {
			await this.__read();
		} catch (error) {
			this.emit('error', error);
		}
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

		let size = block.sectorCount * SECTOR_SIZE;

		// Zerofill
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			if (this._toRead == null) {
				this._toRead = size;
			} else if (this._toRead === 0) {
				this._block++;
				this._toRead = null;
				this.__read();
				return;
			}
			size = this._toRead;
			this._toRead -= size;
			this.bytesWritten += size;
			this.push(Buffer.alloc(size, 0));
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

		if (bytesRead !== length) {
			// TODO: factorize
			throw new Error(
				`Bytes read mismatch, expected ${size}, got ${bytesRead}`,
			);
		}

		if (block.type !== BLOCK.RAW) {
			const buffer = decompressBlock(block.type, this._blockBuffer, length);
			this.bytesWritten += buffer.length;
			this.push(buffer);
		} else {
			this.bytesWritten += size;
			const buffer = Buffer.allocUnsafe(length);
			this._blockBuffer.copy(buffer);
			this.push(buffer);
		}
	}
}
