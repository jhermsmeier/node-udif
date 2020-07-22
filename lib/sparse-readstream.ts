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

	public _read(): void {
		if (this.destroyed) {
			return;
		}

		if (!this.opened) {
			return void this.once('open', () => this._read());
		}

		const blkx = this.image.resourceFork.blkx;
		const entry = blkx[this._entry];

		if (entry == null) {
			return void this.push(null);
		}

		const block = entry.map.blocks[this._block];
		if (block == null) {
			this._entry++;
			this._block = 0;
			return this._read();
		}

		// Don't read comments or block map terminators
		if (block.type === BLOCK.COMMENT || block.type === BLOCK.TERMINATOR) {
			this._block++;
			return this._read();
		}

		// Ignore zerofill & free, since this is a sparse stream
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			this._block++;
			return this._read();
		}

		const position = this.image.footer!.dataForkOffset + block.compressedOffset;
		const length = block.compressedLength;
		const offset = 0;

		this.image.fs.read(
			this.image.fd,
			this._blockBuffer,
			offset,
			length,
			position,
			(error: Error | null, bytesRead: number) => {
				this._block++;

				if (error != null) {
					return void this.emit('error', error);
				}

				this.bytesRead += bytesRead;

				if (bytesRead !== length) {
					error = new Error(
						`Bytes read mismatch, expected ${length}, got ${bytesRead}`,
					);
					return void this.emit('error', error);
				}

				const chunkPosition =
					entry.map.sectorNumber * SECTOR_SIZE +
					block.sectorNumber * SECTOR_SIZE;

				if (block.type !== BLOCK.RAW) {
					decompressBlock(
						block.type,
						this._blockBuffer,
						length,
						(err: Error | null, buffer?: Buffer) => {
							if (err != null) {
								return void this.emit('error', err);
							}
							if (buffer !== undefined) {
								this.bytesWritten += buffer.length;
								this.push({ buffer, position: chunkPosition });
							}
						},
					);
				} else {
					this.bytesWritten += length;
					let buffer;
					try {
						buffer = Buffer.allocUnsafe(length);
					} catch (error) {
						return void this.emit('error', error);
					}
					this._blockBuffer.copy(buffer);
					this.push({ buffer, position: chunkPosition });
				}
			},
		);
	}
}
