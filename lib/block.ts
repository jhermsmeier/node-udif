import { BLOCK } from './constants';
import { readBE, writeBE } from './uint64';

/**
 * Mish Blkx Block Descriptor
 */
export class Block {
	/**
	 * Size of the Mish Blkx Block Descriptor in bytes
	 */
	public static readonly SIZE = 40;

	/** Entry / compression type */
	type = 0x00000000;
	/** Entry type name */
	description = 'UNKNOWN';
	/** Comment ('+beg'|'+end' if type == COMMENT) */
	comment = '';
	/** Start sector of this chunk */
	sectorNumber = 0x0000000000000000;
	/** Number of sectors in this chunk */
	sectorCount = 0x0000000000000000;
	/** Start of chunk in data fork */
	compressedOffset = 0x0000000000000000;
	/** Chunk's bytelength in data fork */
	compressedLength = 0x0000000000000000;

	/**
	 * Get a human readable block type
	 */
	public static getDescription(type: BLOCK): string {
		switch (type) {
			case BLOCK.ZEROFILL:
				return 'ZEROFILL';
				break;
			case BLOCK.RAW:
				return 'UDRW (raw)';
				break;
			case BLOCK.FREE:
				return 'FREE (unallocated)';
				break;
			case BLOCK.UDCO:
				return 'UDCO (adc-compressed)';
				break;
			case BLOCK.UDZO:
				return 'UDZO (zlib-compressed)';
				break;
			case BLOCK.UDBZ:
				return 'UDBZ (bzip2-compressed)';
				break;
			case BLOCK.COMMENT:
				return 'COMMENT';
				break;
			case BLOCK.TERMINATOR:
				return 'TERMINATOR';
				break;
			default:
				return 'UNKNOWN';
				break;
		}
	}

	/**
	 * Parse Mish Block data from a buffer
	 */
	public static parse(buffer: Buffer, offset = 0) {
		return new Block().parse(buffer, offset);
	}

	/**
	 * Parse Mish Block data from a buffer
	 */
	public parse(buffer: Buffer, offset = 0) {
		this.type = buffer.readUInt32BE(offset + 0);
		this.description = Block.getDescription(this.type);
		this.comment = buffer
			.toString('ascii', offset + 4, offset + 8)
			.replace(/\u0000/g, '');
		this.sectorNumber = readBE(buffer, offset + 8);
		this.sectorCount = readBE(buffer, offset + 16);
		this.compressedOffset = readBE(buffer, offset + 24);
		this.compressedLength = readBE(buffer, offset + 32);
		return this;
	}

	/**
	 * Write Mish Block data to a buffer
	 */
	public write(buffer: Buffer, offset = 0) {
		buffer.writeUInt32BE(this.type, offset + 0);
		buffer.write(this.comment, offset + 4, 4, 'ascii');
		writeBE(buffer, this.sectorNumber, offset + 8);
		writeBE(buffer, this.sectorCount, offset + 16);
		writeBE(buffer, this.compressedOffset, offset + 24);
		writeBE(buffer, this.compressedLength, offset + 32);
		return buffer;
	}
}
