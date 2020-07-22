import { Readable, ReadableOptions } from 'stream';

import { Image } from './image';
import { BLOCK, SECTOR_SIZE, decompressBlock } from './';

export class ReadStream extends Readable {
	bytesRead = 0;
	bytesWritten = 0;
	opened = false;
	closed = false;
	destroyed = false;
	_entry = 0;
	_block = 0;
	_toRead: number | null = null;
	_blockBuffer = Buffer.allocUnsafe(2 * 1024 * 1024);

	/** UDIF Image ReadStream */
	constructor(public readonly image: Image, options: ReadableOptions) {
		super(options);
		this.open();
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

		let size = block.sectorCount * SECTOR_SIZE;

		// Zerofill
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			if (this._toRead == null) {
				this._toRead = size;
			} else if (this._toRead === 0) {
				this._block++;
				this._toRead = null;
				return this._read();
			}
			size = this._toRead;
			this._toRead -= size;
			this.bytesWritten += size;
			return void process.nextTick(() => {
				this.push(Buffer.alloc(size, 0));
			});
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
						`Bytes read mismatch, expected ${size}, got ${bytesRead}`,
					);
					return void this.emit('error', error);
				}

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
								this.push(buffer);
							}
						},
					);
				} else {
					this.bytesWritten += size;
					let buffer;
					try {
						buffer = Buffer.allocUnsafe(length);
					} catch (error) {
						return void this.emit('error', error);
					}
					this._blockBuffer.copy(buffer);
					this.push(buffer);
				}
			},
		);
	}

	open() {
		this.image.open((error) => {
			if (error) {
				this.emit('error', error);
			} else {
				this.opened = true;
				this.emit('open');
			}
		});

		return this;
	}

	close(error?: Error) {
		this.destroy(error);
	}

	_close(callback?: (error: Error | null) => void) {
		if (this.closed || this.image.fd == null) {
			if (this.image.fd == null) {
				this.once('open', (err?: Error) => this.close(err));
				return;
			}
			if (callback) {
				process.nextTick(() => callback(null));
			}
			return;
		}

		this.closed = true;
		this.opened = false;

		this.image.close((error) => {
			if (callback != null) {
				callback(error || null);
			}
		});
	}

	_destroy(error: Error | null, done: (err: Error | null) => void) {
		this._close((closeError: Error | null) => {
			done(error || closeError);
		});
	}
}
