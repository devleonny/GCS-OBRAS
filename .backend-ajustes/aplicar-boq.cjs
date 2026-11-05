const fs = require('fs');
const { isDeepStrictEqual } = require('util');
const { db } = require('/gcs/db.js');
const expected = EXPECTED_DATA;
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
async function main() {
 const conn = await db.connect();
 let committed = false;
 try {
  await conn.query('BEGIN');
  await conn.query("SET LOCAL lock_timeout = '10s'");
  const budgets = (await conn.query("SELECT * FROM dados_orcamentos WHERE dados_orcam->>'contrato' = ANY($1::text[]) ORDER BY id FOR UPDATE", [expected.map(o=>o.contrato)])).rows;
  const plans = (await conn.query("SELECT * FROM planos_diarios WHERE id = ANY($1::text[]) OR plano_id = ANY($1::text[]) ORDER BY id FOR UPDATE", [['imile-pi','imile-mt','picus']])).rows;
  if(budgets.length!==3) throw Error('Expected three budgets');
  for(const o of budgets) {
   const before=expected.find(e=>e.id===o.id);
   if(!before || !isDeepStrictEqual(o.dados_composicoes,before.dados_composicoes) || !isDeepStrictEqual(o.revisoes,before.revisoes)) throw Error('Budget changed since review: '+o.id);
  }
  const dir='/root/backups/boq-2026-11-04-'+Date.now();
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  fs.writeFileSync(dir+'/before.json',JSON.stringify({budgets,plans},null,2),{mode:0o600});
  console.log('BACKUP '+dir+'/before.json');
  const report=[];
  for(const o of budgets) {
   const contract=o.dados_orcam.contrato;
   if(contract==='ORC_6223') continue;
   const c=structuredClone(o.dados_composicoes);
   const set=(key,changes)=>{if(!c[key])throw Error('Missing item '+key);Object.assign(c[key],changes);};
   if(contract==='ORC_6222') {
    for(const key of ['25-AVULSO','66-AVULSO'])set(key,{qtde:411,descricao:'Eletrocalha 100x50mm'});
    for(const key of ['26-AVULSO','67-AVULSO'])set(key,{qtde:60});
    for(const key of ['27-AVULSO','68-AVULSO'])set(key,{qtde:54,descricao:'Perfilado DN25'});
    for(const key of ['66-AVULSO','67-AVULSO','68-AVULSO'])set(key,{custo:28});
   } else if(contract==='ORC_6224') {
    for(const key of ['28-AVULSO','70-AVULSO'])set(key,{qtde:198,descricao:'Perfilado DN20'});
    for(const key of ['69-AVULSO','70-AVULSO'])set(key,{custo:28});
   }
   const totals={geral:0,bruto:0,servicos:0};
   function sum(x){if(!x.principal_removido){totals.geral+=Number(x.custo||0)*Number(x.qtde||0);totals.bruto+=Number(x.custo_original||x.custo||0)*Number(x.qtde||0);if(x.tipo!=='VENDA')totals.servicos+=Number(x.custo||0)*Number(x.qtde||0);}for(const a of Object.values(x.agrupamento||{}))sum(a);}
   Object.values(c).forEach(sum);
   const required=contract==='ORC_6222'?107603:124699;
   if(round(totals.servicos)!==required)throw Error('Service total mismatch');
   const revisions=structuredClone(o.revisoes);
   if(revisions?.atual && revisions.historico?.[revisions.atual])revisions.historico[revisions.atual]=structuredClone(c);
   await conn.query('UPDATE dados_orcamentos SET dados_composicoes=$2::jsonb,total_geral=$3,total_bruto=$4,revisoes=$5::jsonb WHERE id=$1',[o.id,JSON.stringify(c),round(totals.geral),round(totals.bruto),JSON.stringify(revisions)]);
   report.push({contract,before:o.total_geral,after:round(totals.geral),services:required});
  }
  for(const id of ['imile-pi','imile-mt']) {
   const p=plans.find(x=>x.id===id&&x.tipo==='plano');if(!p)throw Error('Plan missing '+id);
   const data=structuredClone(p.dados);
   const update=(id,previsto)=>{const a=data.atividades.find(a=>a.id===id);if(!a)throw Error('Activity missing');a.previsto=previsto;};
   if(id==='imile-pi')update('10',411);
   else {update('7',77);update('11',120);update('12',198);const a=data.atividades.find(a=>a.id==='8');if(a.previsto!==7520)throw Error('Unexpected network quantity');a.unidade='metro';a.descricao='Instalar cabo de rede';}
   for(const a of data.atividades){const accumulated=Number(a.inicial||0)+plans.filter(d=>d.plano_id===id&&d.tipo==='dia'&&d.excluido===null).reduce((s,d)=>s+Number(d.dados.executado?.[a.id]||0),0);if(accumulated>a.previsto)throw Error('Progress exceeds new forecast');}
   await conn.query('UPDATE planos_diarios SET dados=$2::jsonb,versao=versao+1,atualizado_em=NOW(),atualizado_por=$3 WHERE id=$1',[id,JSON.stringify(data),'Codex - atualizacao BOQ autorizada']);
  }
  const afterBudgets=(await conn.query("SELECT * FROM dados_orcamentos WHERE id = ANY($1::text[])",[budgets.map(o=>o.id)])).rows;
  for(const before of budgets){const after=afterBudgets.find(o=>o.id===before.id);for(const k of Object.keys(before)){if(['dados_composicoes','total_geral','total_bruto','revisoes'].includes(k)&&before.dados_orcam.contrato!=='ORC_6223')continue;if(!isDeepStrictEqual(before[k],after[k]))throw Error('Unexpected changed field '+k);}}
  const afterPlans=(await conn.query("SELECT * FROM planos_diarios WHERE id = ANY($1::text[])",[plans.map(o=>o.id)])).rows;
  for(const before of plans){const after=afterPlans.find(o=>o.id===before.id);if(before.tipo==='dia'||before.id==='picus'){if(!isDeepStrictEqual(before,after))throw Error('Unexpected daily/Picus edit');}else{const expectedData=structuredClone(before.dados);const actualData=structuredClone(after.dados);delete expectedData.atividades;delete actualData.atividades;if(!isDeepStrictEqual(expectedData,actualData))throw Error('Plan metadata changed');for(const a of before.dados.atividades){const b=after.dados.atividades.find(x=>x.id===a.id);if(a.inicial!==b.inicial||a.diaModelo!==b.diaModelo)throw Error('Initial progress changed');}}}
  await conn.query('COMMIT');committed=true;
  fs.writeFileSync(dir+'/result.json',JSON.stringify(report,null,2),{mode:0o600});
  console.log('COMMITTED '+JSON.stringify(report));
 }catch(e){if(!committed)await conn.query('ROLLBACK');throw e;}finally{conn.release();}
 for(const name of ['mvw_custos_cc','mvw_dados_orcamentos','mw_qtde_status_orcamentos']) {
  const concurrent=name!=='mw_qtde_status_orcamentos';
  console.log('REFRESH START '+name);
  await db.query('REFRESH MATERIALIZED VIEW '+(concurrent?'CONCURRENTLY ':'')+name);
  console.log('REFRESH OK '+name);
 }
 console.log('DONE');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>db.end());
