import { Checksum } from './checksum';
import { readBE, writeBE } from './uint64';

/**
 * UDIF Footer (aka Koly Block)
 */
export class Footer {
	/** Koly block structure size in bytes */
	public static readonly SIZE = 512;

	/** Magic 32-bit value; 'koly' in ASCII */
	public static readonly SIGNATURE = 0x6b6f6c79;

	/** UDIF Version (latest known == 4) */
	public static readonly VERSION = 0x00000004;

	/** Signature */
	signature = Footer.SIGNATURE;
	/** Version number */
	version = 0;
	/** Size of this structure in bytes */
	headerSize = 0;
	/** Flags */
	flags = 0;
	/** Running data fork offset (?) */
	runningDataForkOffset = 0;
	/** Data fork offset */
	dataForkOffset = 0;
	/** Data fork length in bytes */
	dataForkLength = 0;
	/** Resource fork offset */
	resourceForkOffset = 0;
	/** Resource fork length in bytes */
	resourceForkLength = 0;
	/** Segment number */
	segmentNumber = 0;
	/** Segment count */
	segmentCount = 0;
	/** Segment ID */
	segmentId = Buffer.alloc(16);
	/** Data checksum */
	dataChecksum = new Checksum();
	/** XML data offset */
	xmlOffset = 0;
	/** XML data length in bytes */
	xmlLength = 0;
	/** Reserved 1 */
	reserved1 = Buffer.alloc(120);
	/** Checksum */
	checksum = new Checksum();
	/** Image variant */
	imageVariant = 0;
	/** Sector count */
	sectorCount = 0;
	/** Reseved 2 */
	reserved2 = 0;
	/** Reseved 3 */
	reserved3 = 0;
	/** Reseved 4 */
	reserved4 = 0;

	/** Parse a Koly block from a buffer */
	public static parse(buffer: Buffer, offset = 0) {
		return new Footer().parse(buffer, offset);
	}

	/** Parse a Koly block from a buffer */
	public parse(buffer: Buffer, offset = 0) {
		this.signature = buffer.readUInt32BE(offset + 0);

		if (this.signature !== Footer.SIGNATURE) {
			const expected = Footer.SIGNATURE.toString(16);
			const actual = this.signature.toString(16);
			throw new Error(
				`Invalid footer signature: Expected 0x${expected}, saw 0x${actual}`,
			);
		}

		this.version = buffer.readUInt32BE(offset + 4);
		this.headerSize = buffer.readUInt32BE(offset + 8);
		this.flags = buffer.readUInt32BE(offset + 12);
		this.runningDataForkOffset = readBE(buffer, offset + 16);
		this.dataForkOffset = readBE(buffer, offset + 24);
		this.dataForkLength = readBE(buffer, offset + 32);
		this.resourceForkOffset = readBE(buffer, offset + 40);
		this.resourceForkLength = readBE(buffer, offset + 48);
		this.segmentNumber = buffer.readUInt32BE(offset + 56);
		this.segmentCount = buffer.readUInt32BE(offset + 60);

		buffer.copy(this.segmentId, 0, offset + 64, offset + 64 + 16);

		this.dataChecksum.parse(buffer, offset + 80);

		this.xmlOffset = readBE(buffer, offset + 216);
		this.xmlLength = readBE(buffer, offset + 224);

		buffer.copy(this.reserved1, 0, offset + 232, offset + 232 + 120);

		this.checksum.parse(buffer, offset + 352);

		this.imageVariant = buffer.readUInt32BE(offset + 488);
		this.sectorCount = readBE(buffer, offset + 492);

		this.reserved2 = buffer.readUInt32BE(offset + 500);
		this.reserved3 = buffer.readUInt32BE(offset + 504);
		this.reserved4 = buffer.readUInt32BE(offset + 508);

		return this;
	}

	/**
	 * Write a Koly block to a buffer
	 */
	write(buffer?: Buffer, offset = 0) {
		buffer = buffer || Buffer.alloc(Footer.SIZE + offset);
		buffer.writeUInt32BE(this.signature, offset + 0);
		buffer.writeUInt32BE(this.version, offset + 4);
		buffer.writeUInt32BE(this.headerSize, offset + 8);
		buffer.writeUInt32BE(this.flags, offset + 12);
		writeBE(buffer, this.runningDataForkOffset, offset + 16);
		writeBE(buffer, this.dataForkOffset, offset + 24);
		writeBE(buffer, this.dataForkLength, offset + 32);
		writeBE(buffer, this.resourceForkOffset, offset + 40);
		writeBE(buffer, this.resourceForkLength, offset + 48);
		buffer.writeUInt32BE(this.segmentNumber, offset + 56);
		buffer.writeUInt32BE(this.segmentCount, offset + 60);

		this.segmentId.copy(buffer, offset + 64);

		this.dataChecksum.write(buffer, offset + 80);

		writeBE(buffer, this.xmlOffset, offset + 216);
		writeBE(buffer, this.xmlLength, offset + 224);

		this.reserved1.copy(buffer, offset + 232);

		this.checksum.write(buffer, offset + 352);

		buffer.writeUInt32BE(this.imageVariant, offset + 488);
		writeBE(buffer, this.sectorCount, offset + 492);

		buffer.writeUInt32BE(this.reserved2, offset + 500);
		buffer.writeUInt32BE(this.reserved3, offset + 504);
		buffer.writeUInt32BE(this.reserved4, offset + 508);

		return buffer;
	}
}
