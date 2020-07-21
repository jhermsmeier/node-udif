const MAX_UINT32 = Math.pow(2, 32);

export function readBE(buffer: Buffer, offset: number) {
	offset = offset || 0;
	const hi = buffer.readUInt32BE(offset);
	const lo = buffer.readUInt32BE(offset + 4);
	return hi * MAX_UINT32 + lo;
}

export function writeBE(buffer: Buffer, value: number, offset: number) {
	offset = offset || 0;
	const hi = value / MAX_UINT32;
	const lo = value - hi * MAX_UINT32;
	buffer.writeUInt32BE(hi, offset);
	buffer.writeUInt32BE(lo, offset + 4);
	return offset + 8;
}
