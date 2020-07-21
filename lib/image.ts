import * as fs from 'fs';
import * as plist from 'apple-plist';
import * as crc32 from 'cyclic-32';
import { ReadableOptions } from 'stream';

import { BLOCK, CHECKSUM_TYPE, SECTOR_SIZE } from './';
import { ReadStream } from './readstream';
import { Footer } from './footer';
import { SparseReadStream } from './sparse-readstream';
import { BlockMap } from './blockmap';

export interface ImageOptions {
	// TODO
	fs?: any;
}

interface Blk {
	ID: string;
	Attributes: string;
	Name: string;
	Data: Buffer;
}

interface ResourceFork {
	blkx?: Array<Blk & { CFName: string }>;
	nsiz?: Blk[];
	cSum?: Blk[];
	plst?: Blk[];
	size?: Blk[];
}

interface InternalBlk {
	id: number;
	attributes: number;
	name: string;
	data: Buffer;
}

interface InternalResourceFork {
	blkx: Array<
		Omit<InternalBlk, 'data'> & { map: BlockMap; coreFoundationName: string }
	>;
	nsiz: InternalBlk[];
	cSum: Array<
		Omit<InternalBlk, 'data'> & {
			data: { unknown: number; type: number; value: string };
		}
	>;
	plst: InternalBlk[];
	size: InternalBlk[];
}

/**
 * Apple Disk Image (DMG)
 */
export class Image {
	fd?: number;
	footer?: Footer;
	resourceFork: InternalResourceFork = {
		blkx: [],
		nsiz: [],
		cSum: [],
		plst: [],
		size: [],
	};
	// TODO
	fs: any;

	constructor(public readonly path: string, options: ImageOptions = {}) {
		this.fs = options.fs || fs;
	}

	public static parseBlkx(
		blkx: NonNullable<ResourceFork['blkx']>,
	): InternalResourceFork['blkx'] {
		return blkx.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			coreFoundationName: block['CFName'],
			map: BlockMap.parse(block['Data']),
		}));
	}

	public static parseNsiz(
		nsiz: NonNullable<ResourceFork['nsiz']>,
	): InternalResourceFork['nsiz'] {
		return nsiz.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: plist.parse(block['Data'].toString()).data,
		}));
	}

	public static parsePlst(
		plst: NonNullable<ResourceFork['plst']>,
	): InternalResourceFork['plst'] {
		return plst.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: block['Data'],
		}));
	}

	public static parseCsum(
		plst: NonNullable<ResourceFork['cSum']>,
	): InternalResourceFork['cSum'] {
		return plst.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: {
				unknown: block['Data'].readUInt16LE(0),
				type: block['Data'].readUInt32LE(2),
				value: block['Data'].toString('hex', 6),
			},
		}));
	}

	public static parseSize(
		size: NonNullable<ResourceFork['size']>,
	): InternalResourceFork['size'] {
		return size.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: block['Data'],
		}));
	}

	/**
	 * Create a readable stream of this image
	 */
	public createReadStream(options: ReadableOptions = {}) {
		return new ReadStream(this, options);
	}

	/** Create a sparse readable stream of this image */
	public createSparseReadStream(options: ReadableOptions = {}) {
		return new SparseReadStream(this, options);
	}

	/** Calculate the uncompressed size of the contained resource */
	public getUncompressedSize() {
		if (!this.resourceFork.blkx) {
			return 0;
		}
		return this.resourceFork.blkx.reduce((size: number, resource) => {
			return resource.map.blocks.reduce((s, block) => {
				return s + block.sectorCount * SECTOR_SIZE;
			}, size);
		}, 0);
	}

	/** Calculate the amount of mapped (non-zero & non-free) bytes */
	public getMappedSize() {
		if (!this.resourceFork.blkx) {
			return 0;
		}
		return this.resourceFork.blkx.reduce((size: number, resource) => {
			return resource.map.blocks.reduce((s, block) => {
				if (block.type !== BLOCK.ZEROFILL && block.type !== BLOCK.FREE) {
					return s + block.sectorCount * SECTOR_SIZE;
				} else {
					return s;
				}
			}, size);
		}, 0);
	}

	public readFooter(
		callback: (this: Image, error: Error | null, footer?: Footer) => void,
	) {
		const length = Footer.SIZE;
		const buffer = Buffer.allocUnsafe(length);

		this.fs.fstat(this.fd, (error: Error | null, stats: fs.Stats) => {
			if (error) {
				return callback.call(this, error);
			}

			const position = stats.size - Footer.SIZE;

			this.fs.read(
				this.fd,
				buffer,
				0,
				length,
				position,
				(err: Error | null, bytesRead: number, buf: Buffer) => {
					if (err) {
						return callback.call(this, err);
					}

					if (bytesRead !== length) {
						err = new Error(
							`Bytes read mismatch, expected ${length}, got ${bytesRead}`,
						);
						return void callback.call(this, err);
					}

					try {
						this.footer = Footer.parse(buf);
					} catch (parseError) {
						return callback.call(this, parseError);
					}

					callback.call(this, null, this.footer);
				},
			);
		});
	}

	public readPropertyList(
		callback: (
			this: Image,
			error: Error | null,
			plist?: InternalResourceFork,
		) => void,
	) {
		if (this.footer === undefined) {
			return callback.call(
				this,
				new Error('Must read footer before property list'),
			);
		}

		const length = this.footer.xmlLength;
		const position = this.footer.xmlOffset;
		const buffer = Buffer.allocUnsafe(length);

		this.fs.read(
			this.fd,
			buffer,
			0,
			length,
			position,
			(error: Error | null, bytesRead: number, buf: Buffer) => {
				if (error) {
					return void callback.call(this, error);
				}

				if (bytesRead !== length) {
					error = new Error(
						`Bytes read mismatch, expected ${length}, got ${bytesRead}`,
					);
					return void callback.call(this, error);
				}

				let data = null;

				try {
					data = plist.parse(buf.toString()).data;
				} catch (error) {
					return void callback.call(this, error);
				}

				const resourceFork: ResourceFork = data['resource-fork'];

				try {
					if (resourceFork.blkx) {
						this.resourceFork.blkx = Image.parseBlkx(resourceFork.blkx);
					}
					if (resourceFork.nsiz) {
						this.resourceFork.nsiz = Image.parseNsiz(resourceFork.nsiz);
					}
					if (resourceFork.cSum) {
						this.resourceFork.cSum = Image.parseCsum(resourceFork.cSum);
					}
					if (resourceFork.plst) {
						this.resourceFork.plst = Image.parsePlst(resourceFork.plst);
					}
					if (resourceFork.size) {
						this.resourceFork.size = Image.parseSize(resourceFork.size);
					}
				} catch (error) {
					return void callback.call(this, error);
				}

				callback.call(this, null, this.resourceFork);
			},
		);
	}

	public verifyData(
		callback: (this: Image, error: Error | null, ok?: boolean | null) => void,
	) {
		if (this.footer === undefined) {
			return callback.call(
				this,
				new Error('Must read footer before calling verifyData'),
			);
		}
		// Return `null` if there's no data checksum, or the type is set to NONE
		if (
			!this.footer.dataChecksum ||
			this.footer.dataChecksum.type === CHECKSUM_TYPE.NONE
		) {
			return void callback.call(this, null, null);
		}

		let hash = null;
		let checksum = '';
		let hadError = false;

		switch (this.footer.dataChecksum.type) {
			case CHECKSUM_TYPE.CRC32:
				hash = new crc32.Hash({ encoding: 'hex' });
				break;
			default:
				const error = new Error(
					`Unknown or unsupported checksum type "${this.footer.dataChecksum.type}"`,
				);
				return void callback.call(this, error);
		}

		const readable = this.fs.createReadStream(null, {
			fd: this.fd,
			autoClose: false,
			start: this.footer.dataForkOffset,
			end: this.footer.dataForkOffset + this.footer.dataForkLength - 1,
		});

		const onError = (error: Error) => {
			if (hadError) {
				return;
			}
			hadError = true;
			callback.call(this, error);
		};

		readable
			.on('error', onError)
			.pipe(hash)
			.on('error', onError)
			.on('readable', function (this: ReadStream) {
				let chunk: Buffer = this.read();
				while (chunk) {
					checksum += chunk;
					chunk = this.read();
				}
			})
			.on('end', () => {
				if (hadError) {
					return;
				}
				callback.call(
					this,
					null,
					checksum === this.footer?.dataChecksum?.value,
				);
			});
	}

	public open(
		callback: (this: Image, error?: Error | null, fd?: number) => void,
	) {
		if (this.fd != null) {
			return callback.call(this, null, this.fd);
		}

		const tasks = [
			(next: (error: Error | null) => void) => {
				this.fs.open(this.path, 'r', (error: Error | null, fd: number) => {
					this.fd = fd;
					next(error);
				});
			},
			(next: () => void) => this.readFooter(next),
			(next: () => void) => this.readPropertyList(next),
		];

		const run = (error?: Error) => {
			if (error) {
				return callback.call(this, error);
			}
			const task = tasks.shift();
			task ? task(run) : callback.call(this);
		};

		run();

		return this;
	}

	public close(callback: (this: Image, error?: Error) => void) {
		if (this.fd == null) {
			return callback.call(this);
		}

		const self = this;

		this.fs.close(this.fd, function (error?: Error) {
			callback.call(self, error);
		});

		this.fd = undefined;

		return this;
	}
}
