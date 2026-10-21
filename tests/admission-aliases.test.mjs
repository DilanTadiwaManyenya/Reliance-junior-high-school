import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
test('sixth-form aliases allocate one global prefix sequence without renumbering',async()=>{
 const db=new PGlite()
 try {
  await db.exec('create table students(admission_number text, class_level text)')
  await db.exec(await readFile(new URL('../supabase/migrations/20261021235000_launch_admission_aliases.sql',import.meta.url),'utf8'))
  for(const label of ['Form 5','Lower Six','Lower 6'])assert.equal((await db.query("select admission_class_code('senior',$1) code",[label])).rows[0].code,'f5')
  await db.exec("insert into students values('26f500','Form 5')")
  assert.equal((await db.query("select next_admission_number(2026,'senior','Lower 6') code")).rows[0].code,'26f501')
  await db.exec("insert into students values('26f501','Lower 6')")
  assert.equal((await db.query("select next_admission_number(2026,'senior','Lower Six') code")).rows[0].code,'26f502')
  assert.equal((await db.query("select admission_class_code('senior','Upper 6') code")).rows[0].code,'f6')
 } finally {await db.close()}
})
