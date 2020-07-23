import * as fs from 'fs';

import * as UDIF from '../lib';

const argv = process.argv.slice(2);
const filename = argv[0];

const stats = fs.statSync(filename);
const fd = fs.openSync(filename, 'r');
const buffer = Buffer.alloc(UDIF.Footer.SIZE);
const offset = 0;
const position = stats.size - 512;

fs.readSync(fd, buffer, offset, buffer.length, position);

const footer = UDIF.Footer.parse(buffer);

const xmlBuffer = Buffer.alloc(footer.xmlLength);

fs.readSync(fd, xmlBuffer, offset, xmlBuffer.length, footer.xmlOffset);

console.log(xmlBuffer);

fs.closeSync(fd);
