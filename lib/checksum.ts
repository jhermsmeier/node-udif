import { CHECKSUM_TYPE } from './constants';

/**
 * UDIF Checksum Structure
 */
export class Checksum {
	/**
	 * Checksum struct size in bytes
	 * @todo verify correctness of this value
	 */
	public static readonly SIZE = 128;

	/** Checksum type (uint32) */
	type = CHECKSUM_TYPE.NONE;

	/** Checksum size in bits (uint32) */
	bits = 0x00000000;

	/** Checksum as hex string */
	value = '';

	/** Parse a UDIF checksum struct from a buffer */
	public static parse(buffer: Buffer, offset: number) {
		return new Checksum().parse(buffer, offset);
	}

	/** Parse a UDIF checksum structure from a buffer */
	public parse(buffer: Buffer, offset = 0) {
		this.type = buffer.readUInt32BE(offset + 0);
		this.bits = buffer.readUInt32BE(offset + 4);
		this.value = buffer.toString('hex', offset + 8, offset + 8 + this.bits / 8);

		return this;
	}

	/** Write a UDIF checksum structure to a buffer */
	public write(buffer?: Buffer, offset = 0) {
		buffer = buffer || Buffer.alloc(Checksum.SIZE + offset);

		buffer.writeUInt32BE(this.type, offset + 0);
		buffer.writeUInt32BE(this.bits, offset + 4);
		buffer.write(this.value, offset + 8, this.bits / 8, 'hex');

		return buffer;
	}
}
