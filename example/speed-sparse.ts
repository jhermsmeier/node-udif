import * as util from 'util';

import * as UDIF from '../lib';

const argv = process.argv.slice(2);
const filename = argv[0];

function mb(bytes: number) {
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function inspect(value: any) {
	return util.inspect(value, {
		depth: null,
		colors: process.stdout.isTTY,
	});
}

UDIF.withOpenImage(filename, async (image) => {
	console.log(inspect(image));
	console.log('\n');
	console.log('  compressed size:', mb(image.footer!.dataForkLength));
	console.log('uncompressed size:', mb(await image.getUncompressedSize()));
	console.log();
	const start = Date.now();
	let time = 0;
	let bytesRead = 0;
	function tick() {
		console.log(`Bytes read: ${mb(bytesRead)} (${mb(bytesRead / time)}/s)`);
	}
	const timer = setInterval(tick, 250);
	console.log('\n');
	const readable = await image.createSparseReadStream();
	await new Promise((resolve, reject) => {
		readable
			.on('error', reject)
			.on('end', () => {
				resolve();
			})
			.on('data', ({ buffer }: { buffer: Buffer }) => {
				bytesRead += buffer.length;
				time = (Date.now() - start) / 1000;
			});
	});
	console.log('Done.');
	clearInterval(timer);
});
