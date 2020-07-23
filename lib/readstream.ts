import { BLOCK, SECTOR_SIZE } from './constants';
import { Image } from './image';
import { blockDecompressor, blockGenerator, ZeroStream } from './utils';

// Don't read comments or block map terminators
const EXCLUDE: BLOCK[] = [BLOCK.COMMENT, BLOCK.TERMINATOR];

export async function* readStream(image: Image) {
	for (const { block } of blockGenerator(image, EXCLUDE)) {
		const size = block.sectorCount * SECTOR_SIZE;
		if (block.type === BLOCK.ZEROFILL || block.type === BLOCK.FREE) {
			for await (const buffer of new ZeroStream(size)) {
				yield buffer;
			}
		} else {
			const position = image.footer!.dataForkOffset + block.compressedOffset;
			const length = block.compressedLength;
			const inputStream = await image.fs.createReadStream(
				position,
				position + length - 1,
			);
			const stream = blockDecompressor(block.type, inputStream);
			for await (const buffer of stream) {
				yield buffer;
			}
		}
	}
}
