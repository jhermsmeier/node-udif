import { Checksum } from './checksum';
import { readBE, writeBE } from './uint64';
import { Block } from './block';

/**
 * BlockMap (BLKX) data (aka Mish Data)
 */
export class BlockMap {
	/** Size of BlockMap structure in bytes (without Block entries) */
	public static readonly SIZE = 204;

	/** BlockMap data signature */
	public static readonly SIGNATURE = 0x6d697368;

	/** BLKX Version (latest known == 1) */
	public static readonly VERSION = 0x00000001;
	public static readonly Block = Block;

	/** Signature */
	signature = 0x00000000;
	/** Version number */
	version = 0x00000000;
	/** LBA of starting sector */
	sectorNumber = 0x0000000000000000;
	/** Number of sectors in this block range */
	sectorCount = 0x0000000000000000;
	/** Offset of data (within what?) */
	dataOffset = 0x0000000000000000;
	/** Buffers needed (?) */
	buffersNeeded = 0x00000000;
	/** Block descriptor number */
	blockDescriptorCount = 0x00000000;
	/** Reserved 1 */
	reserved1 = 0x00000000;
	/** Reserved 2 */
	reserved2 = 0x00000000;
	/** Reserved 3 */
	reserved3 = 0x00000000;
	/** Reserved 4 */
	reserved4 = 0x00000000;
	/** Reserved 5 */
	reserved5 = 0x00000000;
	/** Reserved 6 */
	reserved6 = 0x00000000;
	/** Checksum descriptor */
	checksum = new Checksum();
	/** Number of blocks in map */
	blockCount = 0x00000000;
	/** List of mapped blocks */
	blocks: Block[] = [];

	/** Parse BlockMap data from a buffer */
	public static parse(buffer: Buffer, offset = 0) {
		return new BlockMap().parse(buffer, offset);
	}

	/** Parse BlockMap data from a buffer */
	public parse(buffer: Buffer, offset = 0) {
		this.signature = buffer.readUInt32BE(offset + 0);

		if (this.signature !== BlockMap.SIGNATURE) {
			const expected = BlockMap.SIGNATURE.toString(16);
			const actual = this.signature.toString(16);
			throw new Error(
				`Invalid block map signature: Expected 0x${expected}, saw 0x${actual}`,
			);
		}

		this.version = buffer.readUInt32BE(offset + 4);
		this.sectorNumber = readBE(buffer, offset + 8);
		this.sectorCount = readBE(buffer, offset + 16);
		this.dataOffset = readBE(buffer, offset + 24);
		this.buffersNeeded = buffer.readUInt32BE(offset + 32);
		this.blockDescriptorCount = buffer.readUInt32BE(offset + 36);
		this.reserved1 = buffer.readUInt32BE(offset + 40);
		this.reserved2 = buffer.readUInt32BE(offset + 44);
		this.reserved3 = buffer.readUInt32BE(offset + 48);
		this.reserved4 = buffer.readUInt32BE(offset + 52);
		this.reserved5 = buffer.readUInt32BE(offset + 56);
		this.reserved6 = buffer.readUInt32BE(offset + 60);
		this.checksum.parse(buffer, offset + 64);
		this.blockCount = buffer.readUInt32BE(offset + 200);
		this.blocks = [];

		for (let i = 0; i < this.blockCount; i++) {
			this.blocks.push(
				Block.parse(buffer, BlockMap.SIZE + i * Block.SIZE + offset),
			);
		}

		return this;
	}

	/** Write BlockMap data to a buffer */
	public write(buffer: Buffer, offset = 0) {
		const length = BlockMap.SIZE + this.blocks.length * Block.SIZE;

		offset = offset || 0;
		buffer = buffer || Buffer.alloc(length + offset);

		// Update block count
		this.blockCount = this.blocks.length;

		buffer.writeUInt32BE(this.signature, offset + 0);
		buffer.writeUInt32BE(this.version, offset + 4);
		writeBE(buffer, this.sectorNumber, offset + 8);
		writeBE(buffer, this.sectorCount, offset + 16);
		writeBE(buffer, this.dataOffset, offset + 24);
		buffer.writeUInt32BE(this.buffersNeeded, offset + 32);
		buffer.writeUInt32BE(this.blockDescriptorCount, offset + 36);
		buffer.writeUInt32BE(this.reserved1, offset + 40);
		buffer.writeUInt32BE(this.reserved2, offset + 44);
		buffer.writeUInt32BE(this.reserved3, offset + 48);
		buffer.writeUInt32BE(this.reserved4, offset + 52);
		buffer.writeUInt32BE(this.reserved5, offset + 56);
		buffer.writeUInt32BE(this.reserved6, offset + 60);
		this.checksum.write(buffer, offset + 64);
		buffer.writeUInt32BE(this.blockCount, offset + 200);

		for (let i = 0; i < this.blockCount; i++) {
			this.blocks[i].write(buffer, BlockMap.SIZE + i * Block.SIZE + offset);
		}

		return buffer;
	}
}
