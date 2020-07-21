import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';

import * as UDIF from '../lib';

import { images } from './data';

const DATADIR = path.join(__dirname, 'data');

context('UDIF.getUncompressedSize()', function () {
	images.forEach(function (data) {
		specify(data.filename, function (done) {
			UDIF.getUncompressedSize(path.join(DATADIR, data.filename), function (
				error?: Error | null,
				size?: number,
			) {
				assert.ifError(error);
				assert.equal(size, data.uncompressedSize);
				done();
			});
		});
	});
});

context('UDIF.Image', function () {
	images.forEach(function (data) {
		context(data.filename, function () {
			const filename = path.join(DATADIR, data.filename);
			let image: UDIF.Image;

			specify('new UDIF.Image()', function () {
				image = new UDIF.Image(filename);
			});

			specify('image.open()', function (done) {
				image.open(done);
			});

			specify('image.footer.dataForkLength', function () {
				assert.equal(image.footer?.dataForkLength, data.dataForkLength);
			});

			specify('image.getUncompressedSize()', function () {
				assert.equal(image.getUncompressedSize(), data.uncompressedSize);
			});

			specify('image.verifyData()', function (done) {
				image.verifyData(function (
					error: Error | null,
					verified?: boolean | null,
				) {
					if (!error) {
						assert.strictEqual(verified, true);
					}
					done();
				});
			});

			specify('image.close()', function (done) {
				image.close(done);
			});
		});
	});
});

context('UDIF.ReadStream', function () {
	images.forEach(function (data) {
		context(data.filename, function () {
			specify('read & decompress image', function (done) {
				let bytesRead = 0;

				UDIF.createReadStream(path.join(DATADIR, data.filename))
					.on('error', done)
					.on('data', function (chunk: Buffer) {
						bytesRead += chunk.length;
					})
					.on('end', function () {
						assert.equal(bytesRead, data.uncompressedSize);
						done();
					});
			});

			specify('stream an already opened image', function (done) {
				const image = new UDIF.Image(path.join(DATADIR, data.filename));
				let bytesRead = 0;

				image.open(function (error?: Error | null) {
					if (error) {
						return done(error);
					}

					image
						.createReadStream()
						.on('error', done)
						.on('data', function (chunk: Buffer) {
							bytesRead += chunk.length;
						})
						.on('end', function () {
							assert.equal(bytesRead, data.uncompressedSize);
							done();
						});
				});
			});

			specify('can close while reading', function (done) {
				UDIF.createReadStream(path.join(DATADIR, data.filename))
					.on('error', done)
					.on('data', function (this: UDIF.ReadStream) {
						this.close();
					})
					.on('close', function () {
						done();
					});
			});

			specify('can destroy while reading', function (done) {
				UDIF.createReadStream(path.join(DATADIR, data.filename))
					.on('error', done)
					.on('data', function (this: UDIF.ReadStream) {
						this.destroy();
					})
					.on('close', done);
			});
		});
	});

	context('Compression Methods', function () {
		const expected = fs.readFileSync(
			path.join(__dirname, 'data', 'decompressed.img'),
		);
		const sources = [
			'compression-adc.dmg',
			'compression-bz2.dmg',
			// NOTE: LZFSE not yet supported
			// 'compression-lzfse.dmg',
			'compression-raw.dmg',
			'compression-zlib.dmg',
		].map((f) => path.join(__dirname, 'data', f));

		context('source image equality', function () {
			sources.forEach((filename) => {
				const testName = path
					.basename(filename, '.dmg')
					.replace('compression-', '')
					.toUpperCase();

				specify(testName, function (done) {
					UDIF.getUncompressedSize(
						filename,
						(error?: Error | null, size?: number) => {
							if (error) {
								return done(error);
							}
							if (size === undefined) {
								return done();
							}
							const actual = Buffer.allocUnsafe(size);
							let offset = 0;
							UDIF.createReadStream(filename)
								.on('error', done)
								// NOTE: This can catch & bubble up read/push after EOD errors,
								// which have previously gone unnoticed
								.pipe(new stream.PassThrough())
								.on('data', (chunk: Buffer) => {
									chunk.copy(actual, offset);
									offset += chunk.length;
								})
								.once('end', () => {
									assert.ok(expected.equals(actual));
									assert.equal(expected.length, size);
									done();
								});
						},
					);
				});
			});
		});
	});
});

context('UDIF.SparseReadStream', function () {
	images.forEach(function (data) {
		context(data.filename, function () {
			specify('read & decompress image', function (done) {
				let bytesRead = 0;

				UDIF.createSparseReadStream(path.join(DATADIR, data.filename))
					.on('error', done)
					.on('data', function (block: { buffer: Buffer; position: number }) {
						bytesRead += block.buffer.length;
					})
					.on('end', function () {
						assert.equal(bytesRead, data.mappedSize);
						done();
					});
			});

			specify('stream an already opened image', function (done) {
				const image = new UDIF.Image(path.join(DATADIR, data.filename));
				let bytesRead = 0;

				image.open(function (error?: Error | null) {
					if (error) {
						return done(error);
					}

					image
						.createSparseReadStream()
						.on('error', done)
						// TODO: factorize type
						.on('data', function (block: { buffer: Buffer; position: number }) {
							bytesRead += block.buffer.length;
						})
						.on('end', function () {
							assert.equal(bytesRead, data.mappedSize);
							done();
						});
				});
			});

			specify('can close while reading', function (done) {
				UDIF.createSparseReadStream(path.join(DATADIR, data.filename))
					.on('error', done)
					.on('data', function (this: UDIF.SparseReadStream) {
						this.close();
					})
					.on('close', function () {
						done();
					});
			});

			specify('can destroy while reading', function (done) {
				UDIF.createSparseReadStream(path.join(DATADIR, data.filename))
					.on('error', done)
					.on('data', function (this: UDIF.SparseReadStream) {
						this.destroy();
					})
					.on('close', done);
			});
		});
	});

	context('Compression Methods', function () {
		const expected = fs.readFileSync(
			path.join(__dirname, 'data', 'decompressed.img'),
		);
		const sources = [
			'compression-adc.dmg',
			'compression-bz2.dmg',
			// NOTE: LZFSE not yet supported
			// 'compression-lzfse.dmg',
			'compression-raw.dmg',
			'compression-zlib.dmg',
		].map((f) => path.join(__dirname, 'data', f));

		context('source image equality', function () {
			sources.forEach((filename) => {
				const testName = path
					.basename(filename, '.dmg')
					.replace('compression-', '')
					.toUpperCase();

				specify(testName, function (done) {
					UDIF.getUncompressedSize(
						filename,
						(error?: Error | null, size?: number) => {
							if (error) {
								return done(error);
							}
							if (size === undefined) {
								return done();
							}
							const actual = Buffer.alloc(size);
							UDIF.createSparseReadStream(filename)
								.on('error', done)
								// NOTE: This can catch & bubble up read/push after EOD errors,
								// which have previously gone unnoticed
								.pipe(new stream.PassThrough({ objectMode: true }))
								// TODO: factorize type
								.on('data', (chunk: { buffer: Buffer; position: number }) => {
									chunk.buffer.copy(actual, chunk.position);
								})
								.once('end', () => {
									assert.ok(expected.equals(actual), 'Buffer equality');
									assert.equal(expected.length, size);
									done();
								});
						},
					);
				});
			});
		});
	});
});
