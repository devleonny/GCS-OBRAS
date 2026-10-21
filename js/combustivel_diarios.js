function pendenciasAbastecimento(a) {
    return [a.litros == null ? 'litros' : '', a.hodometro == null ? 'hodômetro' : '', !a.foto_hodometro ? 'foto' : ''].filter(Boolean)
}

async function telaComplementacoesCombustivel() {
    overlayAguarde()
    try {
        const [itens,veiculos]=await Promise.all([consultarCombustivel('combustivel_abastecimentos',{ excluido:{ op:'IS_EMPTY' } }),consultarCombustivel('vw_veiculos_opcoes')])
        const porId=new Map(veiculos.map(v => [String(v.id),v]))
        const pendentes=itens.filter(a => pendenciasAbastecimento(a).length).map(a => ({ ...a,veiculo:porId.get(String(a.veiculo_id)) || {},pendencias:pendenciasAbastecimento(a).join(', ') }))
        const tabela=await modTab({ pag:'complementacoesCombustivel',body:'bodyComplementacoesCombustivel',base:pendentes,
            criarLinha:'criarLinhaComplementacaoCombustivel',ordenar:{ path:'data_abastecimento',direcao:'ASC' },colunas:{
                'Data':{ chave:'data_abastecimento',tipoPesquisa:'data' },'Veículo':{ chave:'veiculo.placa' },'Motoristas':{ chave:'veiculo.motoristas_nomes' },
                'Valor':{ chave:'valor_total' },'Cartão':{ chave:'veiculo.cartao' },'Falta informar':{ chave:'pendencias' },'Ação':{}
            } })
        tela.innerHTML=`<div class="pagina-conteudo combustivel-pagamentos-diarios combustivel-pendencias-pagina"><div class="cabecalho-pagina"><h2>Complementações pendentes · ${pendentes.length}</h2></div>${tabela}</div>`
        await paginacao('complementacoesCombustivel')
    } catch (erro) { popup({ mensagem:escaparAtributo(erro.message) }) }
    finally { removerOverlay() }
}

function criarLinhaComplementacaoCombustivel(a) {
    const e=escaparAtributo
    return `<tr><td>${e(formatarDataHistoricoCombustivel(a.data_abastecimento))}</td><td>${e(a.veiculo.placa || a.veiculo_id)}</td><td>${e(a.veiculo.motoristas_nomes || 'Nenhum vinculado')}</td>
        <td>R$ ${formatarCombustivel(a.valor_total)}</td><td>${e(a.veiculo.cartao || 'Sem cartão')}</td><td class="combustivel-alerta">${e(a.pendencias)}</td>
        <td><button type="button" data-id="${e(a.id)}" onclick="editarHodometroAbastecimento(this.dataset.id)">Complementar</button></td></tr>`
}

function resumoCartoesCombustivel(abastecimentos, veiculos) {
    const cadastros = new Map(veiculos.map(v => [String(v.id), v])), grupos = new Map()
    for (const a of abastecimentos.filter(a => !a.excluido)) {
        const v = cadastros.get(String(a.veiculo_id)) || {}, chave = String(a.veiculo_id)
        if (!grupos.has(chave)) grupos.set(chave, { cartao: v.cartao || 'Sem cartão', motoristas: v.motoristas_nomes || 'Nenhum vinculado',
            veiculo: [v.placa,v.modelo].filter(Boolean).join(' · ') || chave, centavos: 0 })
        grupos.get(chave).centavos += Math.round(Number(a.valor_total)*100)
    }
    return [...grupos.values()].sort((a,b) => a.cartao.localeCompare(b.cartao) || a.veiculo.localeCompare(b.veiculo))
}

function repartirDiarioCombustivel(total, pesos) {
    const soma=[...pesos.values()].reduce((s,v) => s+v,0)
    if (!soma) return []
    const partes=[...pesos].filter(([,v]) => v>0).sort(([a],[b]) => a.localeCompare(b)).map(([id,v]) => {
        const bruto=total*v/soma
        return { id,valor:Math.floor(bruto),resto:bruto-Math.floor(bruto) }
    })
    const ordem=[...partes].sort((a,b) => b.resto-a.resto || a.id.localeCompare(b.id))
    const resto=total-partes.reduce((s,p) => s+p.valor,0)
    for (let i=0;i<resto;i++) ordem[i%ordem.length].valor++
    return partes
}

function distribuicaoDiariaCombustivel(dia, abastecimentos, rateios) {
    const bases=new Map(), porId=new Map(rateios.map(r => [String(r.id),r])), transitorio=dia.pagamento_config.transitorio || 'A definir no painel'
    for (const a of abastecimentos) {
        const pesos=new Map(), litros=Number(a.litros)
        let usados=0
        if (litros>0) for (const d of porId.get(String(a.id))?.departamentos || []) {
            usados+=Number(d.litros)
            pesos.set(d.departamento,(pesos.get(d.departamento)||0)+Number(d.litros))
        }
        if (!litros) pesos.set(transitorio,1)
        else if (litros>usados) pesos.set(transitorio,(pesos.get(transitorio)||0)+litros-usados)
        for (const p of repartirDiarioCombustivel(Math.round(Number(a.valor_total)*100),pesos)) bases.set(p.id,(bases.get(p.id)||0)+p.valor)
    }
    const taxa=new Map(repartirDiarioCombustivel(Math.round(Number(dia.taxa)*100),bases).map(p => [p.id,p.valor]))
    return [...bases].map(([id,base]) => ({ id,base,taxa:taxa.get(id)||0 }))
}

async function telaPagamentosDiariosCombustivel() {
    overlayAguarde()
    try {
        const dias=await consultarCombustivel('vw_combustivel_diarios')
        const tabela=await modTab({ pag:'pagamentosDiariosCombustivel',body:'bodyPagamentosDiariosCombustivel',base:dias,
            criarLinha:'criarLinhaPagamentoDiarioCombustivel',ordenar:{ path:'data_pagamento',direcao:'DESC' },colunas:{
                'Data':{ chave:'data_pagamento',tipoPesquisa:'data' },'Empresa':{ chave:'app' },'Abastecimentos':{ chave:'quantidade' },
                'Dados pendentes':{ chave:'pendentes' },'Abastecimentos (R$)':{ chave:'valor_abastecimentos' },'Taxa':{ chave:'taxa' },
                'Total':{ chave:'valor_total' },'Omie':{ chave:'situacao' },'Detalhes':{}
            } })
        tela.innerHTML=`<div class="pagina-conteudo combustivel-pagamentos-diarios"><div class="cabecalho-pagina"><h2>Pagamentos Ticket Log</h2></div>${tabela}</div>`
        await paginacao('pagamentosDiariosCombustivel')
    } catch (erro) { popup({ mensagem:escaparAtributo(erro.message) }) }
    finally { removerOverlay() }
}

function criarLinhaPagamentoDiarioCombustivel(d) {
    const e=escaparAtributo,n=formatarCombustivel
    return `<tr><td>${e(formatarDataHistoricoCombustivel(d.data_pagamento))}</td><td>${e(d.app || 'A definir')}</td><td>${Number(d.quantidade)}</td><td>${Number(d.pendentes) ? `<button type="button" class="combustivel-pendencias" data-id="${e(d.id)}" onclick="detalhesPagamentoDiarioCombustivel(this.dataset.id)">${Number(d.pendentes)} aguardando técnico</button>` : 'Completo'}</td>
        <td>R$ ${n(d.valor_abastecimentos)}</td><td>R$ ${n(d.taxa)}</td><td>R$ ${n(d.valor_total)}</td><td>${e(d.situacao)}${d.erro ? `<br><small class="combustivel-alerta">${e(d.erro)}</small>` : ''}</td>
        <td class="combustivel-diario-detalhe-celula"><img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" role="button" tabindex="0" title="Ver detalhes do pagamento" alt="Ver detalhes do pagamento" data-id="${e(d.id)}" onclick="detalhesPagamentoDiarioCombustivel(this.dataset.id)" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.click() }"></td></tr>`
}

async function detalhesPagamentoDiarioCombustivel(id) {
    overlayAguarde()
    try {
        const [d,abastecimentos,veiculos,rateios]=await Promise.all([
            recuperarDado('vw_combustivel_diarios',id),
            consultarCombustivel('combustivel_abastecimentos',{ pagamento_diario_id:{ op:'=',value:id },excluido:{ op:'IS_EMPTY' } }),
            consultarCombustivel('vw_veiculos_opcoes'),consultarCombustivel('vw_combustivel_rateios')
        ])
        if (!d?.id) throw new Error('Pagamento diário não encontrado. Atualize a tela.')
        const e=escaparAtributo,n=formatarCombustivel, resumo=resumoCartoesCombustivel(abastecimentos,veiculos)
        const config=new Map(veiculos.map(v => [String(v.id),v]))
        const tabela=(titulos,linhas) => `<div class="combustivel-usos-tabela"><table><thead><tr>${titulos.map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${linhas || `<tr><td colspan="${titulos.length}">Nenhum registro.</td></tr>`}</tbody></table></div>`
        const distribuicao=distribuicaoDiariaCombustivel(d,abastecimentos,rateios)
        const cfg=d.pagamento_config || {}
        for (const [nome,base,retorno] of [['ticket_fornecedor','clientes','nome'],['ticket_categoria','mesc_categorias','id'],['ticket_transitorio','mesc_departamentos','id']])
            controlesCxOpcoes[nome]={ base,retornar:[retorno],colunas:{ 'Cadastro':{ chave:retorno } } }
        const opcao=(nome,titulo,id,descricao=id) => `<label>${titulo}<span class="opcoes" name="${nome}" id="${e(id)}" onclick="cxOpcoes('${nome}')">${e(descricao)}</span></label>`
        popupFormularioCombustivel({ titulo:`Ticket Log · ${formatarDataHistoricoCombustivel(d.data_pagamento)} · ${d.app || 'Configurar pagamento'}`,elemento:`
            <form data-diario="${e(id)}" onsubmit="event.preventDefault(); salvarTaxaDiariaCombustivel(this)">
            <div class="combustivel-diario-detalhes">
                <div class="combustivel-diario-totais"><span>Abastecimentos<strong>R$ ${n(d.valor_abastecimentos)}</strong></span><span>Taxa<strong>R$ ${n(d.taxa)}</strong></span><span>Total<strong>R$ ${n(d.valor_total)}</strong></span></div>
                <p>${e(d.situacao)}${d.codigo_lancamento_omie ? ` · Omie: ${e(d.codigo_lancamento_omie)}` : ''}</p>
                ${d.erro ? `<p class="combustivel-alerta">${e(d.erro)}</p>` : ''}
                <h3>Valores por cartão</h3><p>Valores de crédito dos veículos, sem a taxa do pagamento. Motoristas vinculados compartilham o valor do veículo.</p>
                ${tabela(['Motorista(s)','Veículo','Valor','Cartão'],resumo.map(r => `<tr><td>${e(r.motoristas)}</td><td>${e(r.veiculo)}</td><td>R$ ${n(r.centavos/100)}</td><td>${e(r.cartao)}</td></tr>`).join(''))}
                <h3>Distribuição por departamento</h3>
                ${tabela(['Departamento','Abastecimentos','Taxa proporcional','Total'],distribuicao.map(r => `<tr><td>${e(r.id)}</td><td>R$ ${n(r.base/100)}</td><td>R$ ${n(r.taxa/100)}</td><td>R$ ${n((r.base+r.taxa)/100)}</td></tr>`).join(''))}
                <h3>Abastecimentos do dia</h3>
                ${tabela(['Veículo','Valor','Cartão','Complementação','Ação'],abastecimentos.map(a => `<tr><td>${e(config.get(String(a.veiculo_id))?.placa || a.veiculo_id)}</td><td>R$ ${n(a.valor_total)}</td><td>${e(config.get(String(a.veiculo_id))?.cartao || 'Sem cartão')}</td><td>${pendenciasAbastecimento(a).length ? `<span class="combustivel-alerta">Pendente: ${pendenciasAbastecimento(a).map(e).join(', ')}</span>` : 'Completo'}</td><td><button type="button" data-id="${e(a.id)}" onclick="editarHodometroAbastecimento(this.dataset.id)">${pendenciasAbastecimento(a).length ? 'Complementar' : 'Editar'}</button></td></tr>`).join(''))}
            </div>
            <h3>Configuração financeira</h3>
            <label>Empresa do pagamento<select name="app" required><option value="">Selecionar empresa</option>${empresas.filter(x => ['AC','IAC','HNK'].includes(x)).map(x => `<option ${d.app===x ? 'selected' : ''}>${e(x)}</option>`).join('')}</select></label>
            ${opcao('ticket_fornecedor','Fornecedor',cfg.fornecedor || '6066446384',!cfg.fornecedor || cfg.fornecedor==='6066446384' ? 'TICKET LOG' : cfg.fornecedor)}
            ${opcao('ticket_categoria','Categoria',cfg.categoria || 'Combustível')}
            ${opcao('ticket_transitorio','Centro de custo transitório',cfg.transitorio || 'COMBUSTÍVEL NÃO ALOCADO')}
            <label>Taxa do pagamento (R$)<input name="taxa" inputmode="decimal" required value="${e(d.taxa)}"></label>
            <p role="status"></p><button type="submit">Salvar pagamento</button></form>` })
    } catch (erro) { popup({ mensagem:escaparAtributo(erro.message) }) }
    finally { removerOverlay() }
}

async function salvarTaxaDiariaCombustivel(form) {
    const botao=form.querySelector('[type="submit"]')
    if (botao.disabled) return
    botao.disabled=true
    estadoEnvioCombustivel(form,true)
    try {
        const texto=form.elements.namedItem('taxa').value.trim()
        if (!texto) throw new Error('Informe a taxa, ou zero quando não houver.')
        const taxa=numeroCombustivel(texto)
        if (Math.abs(taxa*100-Math.round(taxa*100))>1e-7) throw new Error('Informe a taxa com até duas casas decimais.')
        const diario=await recuperarDado('combustivel_pagamentos_diarios',form.dataset.diario)
        if (!diario?.id || !diario.data_pagamento || !diario.pagamento_config)
            throw new Error('Pagamento diário não encontrado ou incompleto. Reabra o painel.')
        const app=form.elements.namedItem('app')?.value || diario.app
        const referencia=(nome,chave) => form.querySelector(`[name="${nome}"]`)?.id || diario.pagamento_config[chave]
        const fornecedor=referencia('ticket_fornecedor','fornecedor'),categoria=referencia('ticket_categoria','categoria'),transitorio=referencia('ticket_transitorio','transitorio')
        if (!['AC','IAC','HNK'].includes(app) || !fornecedor || !categoria || !transitorio)
            throw new Error('Selecione empresa, fornecedor, categoria e centro transitório.')
        const resposta=await enviar(`combustivel_pagamentos_diarios/${form.dataset.diario}`,{ ...diario,taxa,app,pagamento_config:{ ...diario.pagamento_config,app,fornecedor,categoria,transitorio } })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Falha ao salvar taxa.')
        removerPopup(form.closest('.popup').id)
        await telaPagamentosDiariosCombustivel()
    } catch (erro) { form.querySelector('[role="status"]').textContent=erro.message }
    finally { botao.disabled=false; estadoEnvioCombustivel(form,false) }
}
