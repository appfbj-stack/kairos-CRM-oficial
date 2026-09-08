const { Prisma } = require('@prisma/internals');
const fs = require('fs');
const datamodel = fs.readFileSync('prisma/schema.prisma', 'utf8');
Prisma.getDMMF({ datamodel })
  .then((d) => console.log('OK', d.datamodel.models.length, 'models'))
  .catch((e) => {
    console.error('ERR:', e.message);
    if (e.cause) console.error('CAUSE:', e.cause);
    process.exit(1);
  });
