import * as util from 'util';

import * as UDIF from '../lib';

const argv = process.argv.slice(2);
const filename = argv[0];

function inspect(value: any) {
	return util.inspect(value, {
		depth: null,
		colors: process.stdout.isTTY,
	});
}

UDIF.withOpenImage(filename, async (image) => {
	console.log(inspect(image));
	console.log('');
	console.log('Uncompressed size:', await image.getUncompressedSize());
	console.log('Mapped size:', await image.getMappedSize());
});
