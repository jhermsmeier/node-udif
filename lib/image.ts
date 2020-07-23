import * as plist from 'apple-plist';
import * as crc32 from 'cyclic-32';
import { ReadableOptions, Transform } from 'stream';

import { BLOCK, CHECKSUM_TYPE, SECTOR_SIZE } from './constants';
import { ReadStream } from './readstream';
import { Footer } from './footer';
import { SparseReadStream } from './sparse-readstream';
import { BlockMap } from './blockmap';

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

export type InternalEntry = Omit<InternalBlk, 'data'> & {
	map: BlockMap;
	coreFoundationName: string;
};

interface InternalResourceFork {
	blkx: InternalEntry[];
	nsiz: InternalBlk[];
	cSum: Array<
		Omit<InternalBlk, 'data'> & {
			data: { unknown: number; type: number; value: string };
		}
	>;
	plst: InternalBlk[];
	size: InternalBlk[];
}

interface Fs {
	size: number;
	read: (
		buffer: Buffer,
		offset: number,
		length: number,
		position: number,
	) => Promise<{ buffer: Buffer; bytesRead: number }>;
	createReadStream: (
		start?: number,
		end?: number,
	) => Promise<NodeJS.ReadableStream>;
}

/**
 * Apple Disk Image (DMG)
 */
export class Image {
	footer?: Footer;
	resourceFork: InternalResourceFork = {
		blkx: [],
		nsiz: [],
		cSum: [],
		plst: [],
		size: [],
	};
	public readonly fs: Fs;
	public readonly ready: Promise<void>;

	constructor(fs: Fs) {
		this.fs = {
			size: fs.size,
			createReadStream: fs.createReadStream,
			read: async (
				buf: Buffer,
				offset: number,
				length: number,
				position: number,
			) => {
				const { buffer, bytesRead } = await fs.read(
					buf,
					offset,
					length,
					position,
				);
				if (bytesRead !== length) {
					throw new Error(
						`Bytes read mismatch, expected ${length}, got ${bytesRead}`,
					);
				}
				return { buffer, bytesRead };
			},
		};
		this.ready = this.open();
	}

	private async open(): Promise<void> {
		await this.readFooter();
		await this.readPropertyList();
	}

	private static parseBlkx(
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

	private static parseNsiz(
		nsiz: NonNullable<ResourceFork['nsiz']>,
	): InternalResourceFork['nsiz'] {
		return nsiz.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: plist.parse(block['Data'].toString()).data,
		}));
	}

	private static parsePlst(
		plst: NonNullable<ResourceFork['plst']>,
	): InternalResourceFork['plst'] {
		return plst.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: block['Data'],
		}));
	}

	private static parseCsum(
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

	private static parseSize(
		size: NonNullable<ResourceFork['size']>,
	): InternalResourceFork['size'] {
		return size.map((block) => ({
			id: +block['ID'],
			attributes: +block['Attributes'],
			name: block['Name'],
			data: block['Data'],
		}));
	}

	/** Create a readable stream of this image */
	public async createReadStream(options: ReadableOptions = {}) {
		await this.ready;
		return new ReadStream(this, options);
	}

	/** Create a sparse readable stream of this image */
	public async createSparseReadStream(options: ReadableOptions = {}) {
		await this.ready;
		return new SparseReadStream(this, options);
	}

	/** Calculate the uncompressed size of the contained resource */
	public async getUncompressedSize() {
		await this.ready;
		return this.resourceFork.blkx.reduce((size: number, resource) => {
			return resource.map.blocks.reduce((s, block) => {
				return s + block.sectorCount * SECTOR_SIZE;
			}, size);
		}, 0);
	}

	/** Calculate the amount of mapped (non-zero & non-free) bytes */
	public async getMappedSize() {
		await this.ready;
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

	public async verifyData(): Promise<boolean | null> {
		await this.ready;
		if (this.footer === undefined) {
			throw new Error('Must read footer before calling verifyData');
		}
		// Return `null` if there's no data checksum, or the type is set to NONE
		if (
			!this.footer.dataChecksum ||
			this.footer.dataChecksum.type === CHECKSUM_TYPE.NONE
		) {
			return null;
		}
		let hash: Transform;
		let checksum = '';
		if (this.footer.dataChecksum.type === CHECKSUM_TYPE.CRC32) {
			hash = new crc32.Hash({ encoding: 'hex' });
		} else {
			throw new Error(
				`Unknown or unsupported checksum type "${this.footer.dataChecksum.type}"`,
			);
		}

		const readable = await this.fs.createReadStream(
			this.footer.dataForkOffset,
			this.footer.dataForkOffset + this.footer.dataForkLength - 1,
		);

		return await new Promise((resolve, reject) => {
			readable
				.on('error', reject)
				.pipe(hash)
				.on('error', reject)
				.on('readable', function (this: ReadStream) {
					let chunk: string = this.read();
					while (chunk) {
						checksum += chunk;
						chunk = this.read();
					}
				})
				.on('end', () => {
					resolve(checksum === this.footer?.dataChecksum?.value);
				});
		});
	}

	private async readFooter(): Promise<Footer> {
		const length = Footer.SIZE;
		const position = this.fs.size - Footer.SIZE;
		const { buffer } = await this.fs.read(
			Buffer.allocUnsafe(length),
			0,
			length,
			position,
		);
		this.footer = Footer.parse(buffer);
		return this.footer;
	}

	private async readPropertyList(): Promise<InternalResourceFork> {
		if (this.footer === undefined) {
			throw new Error('Must read footer before property list');
		}
		const length = this.footer.xmlLength;
		const position = this.footer.xmlOffset;
		const { buffer } = await this.fs.read(
			Buffer.allocUnsafe(length),
			0,
			length,
			position,
		);
		const data = plist.parse(buffer.toString()).data;
		const resourceFork: ResourceFork = data['resource-fork'];
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
		return this.resourceFork;
	}
}
