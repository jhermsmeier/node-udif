import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';

import * as UDIF from '../lib';

import { images } from './data';

const DATADIR = path.join(__dirname, 'data');

context('UDIF.getUncompressedSize()', () => {
	images.forEach((data) => {
		specify(data.filename, async () => {
			const size = await UDIF.getUncompressedSize(
				path.join(DATADIR, data.filename),
			);
			assert.equal(size, data.uncompressedSize);
		});
	});
});

context('UDIF.Image', () => {
	images.forEach((data) => {
		context(data.filename, async () => {
			const filename = path.join(DATADIR, data.filename);
			await UDIF.withOpenImage(filename, async (image) => {
				specify('image.footer.dataForkLength', () => {
					assert.equal(image.footer?.dataForkLength, data.dataForkLength);
				});
				specify('image.getUncompressedSize()', async () => {
					assert.equal(await image.getUncompressedSize(), data.uncompressedSize);
				});
				specify('image.verifyData()', async () => {
					const verified = await image.verifyData();
					assert.strictEqual(verified, true);
				});
			});
		});
	});
});

context('UDIF.ReadStream', () => {
	images.forEach((data) => {
		context(data.filename, async () => {
			await UDIF.withOpenImage(path.join(DATADIR, data.filename), async (image) => {
				specify('read & decompress image', async () => {
					let bytesRead = 0;

					const stream = await image.createReadStream();
					await new Promise((resolve, reject) => {
						stream
							.on('error', reject)
							.on('data', (chunk: Buffer) => {
								bytesRead += chunk.length;
							})
							.on('end', () => {
								assert.equal(bytesRead, data.uncompressedSize);
								resolve();
							});
					});
				});
			});
		});
	});

	context('Compression Methods', () => {
		const expected = fs.readFileSync(
			path.join(DATADIR, 'decompressed.img'),
		);
		const sources = [
			'compression-adc.dmg',
			'compression-bz2.dmg',
			// NOTE: LZFSE not yet supported
			// 'compression-lzfse.dmg',
			'compression-raw.dmg',
			'compression-zlib.dmg',
		].map((f) => path.join(DATADIR, f));

		context('source image equality', () => {
			sources.forEach((filename) => {
				const testName = path
					.basename(filename, '.dmg')
					.replace('compression-', '')
					.toUpperCase();

				specify(testName, async () => {
					await UDIF.withOpenImage(filename, async (image) => {
						const size = await image.getUncompressedSize();
						const actual = Buffer.allocUnsafe(size);
						let offset = 0;
						const stream = await image.createReadStream();
						await new Promise((resolve, reject) => {
							stream
								.on('error', reject)
								// NOTE: This can catch & bubble up read/push after EOD errors,
								// which have previously gone unnoticed
								.pipe(new PassThrough())
								.on('data', (chunk: Buffer) => {
									chunk.copy(actual, offset);
									offset += chunk.length;
								})
								.once('end', () => {
									assert.ok(expected.equals(actual));
									assert.equal(expected.length, size);
									resolve();
								});
						});
					});
				});
			});
		});
	});
});

context('UDIF.SparseReadStream', () => {
	images.forEach((data) => {
		context(data.filename, () => {
			specify('read & decompress image', async () => {
				await UDIF.withOpenImage(path.join(DATADIR, data.filename), async (image) => {
					const stream = await image.createSparseReadStream();
					await new Promise((resolve, reject) => {
						let bytesRead = 0;
						stream
							.on('error', reject)
							.on('data', (block: { buffer: Buffer; position: number }) => {
								bytesRead += block.buffer.length;
							})
							.on('end', () => {
								assert.equal(bytesRead, data.mappedSize);
								resolve();
							});
					});
				});
			});
		});
	});

	context('Compression Methods', () => {
		const expected = fs.readFileSync(
			path.join(DATADIR, 'decompressed.img'),
		);
		// TODO: factorize
		const sources = [
			'compression-adc.dmg',
			'compression-bz2.dmg',
			// NOTE: LZFSE not yet supported
			// 'compression-lzfse.dmg',
			'compression-raw.dmg',
			'compression-zlib.dmg',
		].map((f) => path.join(DATADIR, f));

		context('source image equality', () => {
			sources.forEach((filename) => {
				const testName = path
					.basename(filename, '.dmg')
					.replace('compression-', '')
					.toUpperCase();

				specify(testName, async () => {
					await UDIF.withOpenImage(filename, async (image) => {
						const size = await image.getUncompressedSize();
						const actual = Buffer.alloc(size);
						const stream = await image.createSparseReadStream();
						await new Promise((resolve, reject) => {
							stream
								.on('error', reject)
								// NOTE: This can catch & bubble up read/push after EOD errors,
								// which have previously gone unnoticed
								.pipe(new PassThrough({ objectMode: true }))
								.on('data', (chunk: { buffer: Buffer; position: number }) => {
									chunk.buffer.copy(actual, chunk.position);
								})
								.once('end', () => {
									assert.ok(expected.equals(actual), 'Buffer equality');
									assert.equal(expected.length, size);
									resolve();
								});
						});
					});
				});
			});
		});
	});
});
