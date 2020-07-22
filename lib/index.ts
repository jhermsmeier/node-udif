import * as zlib from 'zlib';
import * as bunzip from 'seek-bzip';
import * as adc from 'apple-data-compression';

import { Checksum } from './checksum';
import { Image } from './image';
import { ReadStream } from './readstream';
import { SparseReadStream } from './sparse-readstream';

export { Image, Checksum, ReadStream, SparseReadStream };

/**
 * Size of a sector in bytes
 * NOTE: Beware, as this is just a guess based on
 * the sector numbers and their contents in images
 */
export const SECTOR_SIZE = 512;

/** Checksum types */
export enum CHECKSUM_TYPE {
	NONE = 0x00000000,
	CRC32 = 0x00000002,
	// There are more (MD5, etc.), but
	// I haven't found out their values, yet
}

/** Mish Data BLKX types */
export enum BLOCK {
	ZEROFILL = 0x00000000,
	RAW = 0x00000001, // UDRW (UDIF read/write) / UDRO (UDIF read-only)
	// NOTE: Since "Apple_Free" regions are marked with this,
	// and some region's intermittent blocks have it, this is probably "UNALLOCATED"
	FREE = 0x00000002, // Free / Ignored / Unallocated
	UDCO = 0x80000004, // UDCO (UDIF ADC-compressed)
	UDZO = 0x80000005, // UDZO (UDIF zlib-compressed)
	UDBZ = 0x80000006, // UDBZ (UDIF bzip2-compressed)
	LZFSE = 0x80000007, // LZFSE (UDIF LZ-FSE-compressed)
	COMMENT = 0x7ffffffe,
	TERMINATOR = 0xffffffff,
}

/** Get the uncompressed size of a given image */
export function getUncompressedSize(
	filename: string,
	callback: (error?: Error | null, size?: number) => void,
) {
	const dmg = new Image(filename);
	dmg.open((error) => {
		if (error) {
			return void callback(error);
		}
		const size = dmg.getUncompressedSize();
		dmg.close((err) => {
			callback(err, size);
		});
	});
}

/** Decompress an image block */
export function decompressBlock(
	type: BLOCK,
	buffer: Buffer,
	length: number,
	callback: (error: Error | null, buffer?: Buffer) => void,
) {
	if (typeof length === 'function') {
		callback = length;
		length = buffer.length;
	}

	try {
		switch (type) {
			case BLOCK.UDZO:
				callback(null, zlib.inflateSync(buffer));
				break;
			case BLOCK.UDBZ:
				callback(null, bunzip.decode(buffer));
				break;
			case BLOCK.UDCO:
				callback(null, adc.decompress(buffer.slice(0, length)));
				break;
			case BLOCK.LZFSE:
				callback(new Error('Unsupported compression method: LZFSE'));
				break;
			default:
				callback(
					new Error(
						'Unknown compression method for type "0x' + type.toString(16) + '"',
					),
				);
				break;
		}
	} catch (error) {
		callback(error);
	}
}
