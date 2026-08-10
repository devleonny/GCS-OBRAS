
async function telaChecklist(idOrcamento = 'ORCA_1faf8f5a-7413-40ac-98d7-11d3d015489f') {

    const {
        dados_orcam,
        dados_composicoes
    } = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    const { contrato, omie_cliente } = dados_orcam || {}
    const { nome } = await recuperarDado('clientes', omie_cliente) || {}

    const {
        checklist
    } = await recuperarDado('vw_checklist', idOrcamento)

    const totais = {}

    for (const { tipo, custo, qtde } of Object.values(dados_composicoes || {})) {

        totais[tipo] ??= {
            total: 0,
            qtde: 0
        }

        totais[tipo].total += (qtde * custo)
        totais[tipo].qtde += 1

    }

    const blocos = Object.entries(totais)
        .map(([tipo, { total, qtde }]) => {

            const estilo = tipo.replaceAll(' ', '-')

            return `
                <div class="tag-checklist ${estilo}">
                    <div style="${vertical}">
                        <span>${tipo}</span>
                        <span>${qtde} Itens</span>
                    </div>
                    <span>${dinheiro(total)}</span>
                </div>
            `
        })
        .join('')

    const itensInst = checklist
        .filter(item => item.filtro == 'INSTALAÇÃO')

    const itensConf = checklist
        .filter(item => item.filtro == 'CONFIGURAÇÃO')

    tela.innerHTML = `
        <div class="painel-geral-checklist">

            <span class="titulo-checklist">${contrato} - ${nome}</span>
            <div class="checklist-painel">
                ${blocos}
            </div>

            <div style="${horizontal}; align-items: start; flex-direction: row; gap: 1rem;">

                ${await tabela(itensInst, 'inst', 'INSTALAÇÃO')}
                ${await tabela(itensConf, 'conf', 'CONFIGURAÇÃO')}

            </div>

        </div>
    `
    await paginacao()

    async function tabela(base, pag, titulo) {

        if (!base.length)
            return ''

        const t = await modTab({
            id: idOrcamento,
            dados_composicoes,
            pag,
            body: pag,
            base,
            ordenar: {
                path: 'descricao',
                direcao: 'asc'
            },
            filtros: {
                'filtro': { op: '!=', value: null }
            },
            criarLinha: 'criarLinhaChecklist',
            colunas: {
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Unidade': { chave: 'unidade' },
                'Quantidade': { chave: 'qtde' },
                'Realizado': {},
                'Andamento': {},
                'Registrar': {}
            },
        })

        return `
            <div style="flex-direction: column;">
                <span class="titulo-2">${titulo}</span>
                ${t}
            </div>
        `

    }

}

async function criarLinhaChecklist(item) {

    const {
        codigo,
        descricao,
        unidade,
        qtde,
        realizado,
    } = item

    const andamento = Number(((realizado / qtde) * 100).toFixed(0))

    return `
        <tr>
            <td>${codigo}</td>
            <td>${descricao}</td>
            <td>${unidade}</td>
            <td>${qtde}</td>
            <td>${realizado || 0}</td>
            <td>
                ${divPorcentagem(andamento)}
            </td>
            <td style="text-align: center;">
                <img src="imagens/lapis.png" onclick="registrarChecklist('${codigo}')">
            </td>
        </tr>
    `

}

async function registrarChecklist(codigo) {

    try {
        overlayAguarde()

        const hoje = new Date().toISOString().slice(0, 10)

        const { id, dados_composicoes } = controles.inst || controles.conf || {}
        const { qtde, descricao, imagem } = dados_composicoes?.[codigo] || {}
        const { detalhamento } = await recuperarDado('checklist', `${codigo}_${id}`) || {}

        const linhas = []

        for (let i = 0; i < qtde; i++) {

            const {
                descricao,
                rack,
                local,
                pilar,
                setor,
                ip,
                realizado,
                data,
                observacao
            } = detalhamento?.[i] || {}

            linhas.push(`
            <tr>
                <td><input name="descricao" value="${descricao || ''}"></td>
                <td><input name="rack" value="${rack || ''}"></td>
                <td><input name="local" value="${local || ''}"></td>
                <td><input name="pilar" value="${pilar || ''}"></td>
                <td><input name="setor" value="${setor || ''}"></td>
                <td><input name="ip" value="${ip || ''}"></td>
                <td style="text-align: center;">
                    <input ${realizado ? 'checked' : ''} name="realizado" style="width: 2rem; height: 2rem;" type="checkbox">
                </td>
                <td><input type="date" name="data" value="${data || ''}"></td>
                <td>
                    <textarea name="observacao">${observacao || ''}</textarea>
                </td>
            </tr>
            `)
        }

        const ths = ['DESCRIÇÃO', 'RACK', 'LOCAL', 'PILAR', 'SETOR', 'IP', 'REALIZADO', 'DATA', 'OBSERVAÇÃO'].map(th => `<th>${th}</th>`).join('')

        const tabela = `
        <div style="padding: 0.5rem;">
            <div style="${horizontal}; justify-content: start; gap: 1rem; padding: 5px;">
                <img src="${imagem || logo}" style="width: 5rem; border-radius: 5px;">
                <span class="titulo-2">${descricao}</span>
            </div>
            <table class="tabela">
                <thead>
                    ${ths}
                </thead>
                <tbody id="checklistAtivo">
                    ${linhas.join('')}
                </tbody>
            </table>
        </div>
        `
        const botoes = [
            {
                texto: 'Salvar',
                funcao: `salvarRegistroChecklist('${codigo}')`,
                img: 'concluido'
            }
        ]

        popup({
            titulo: 'Registrar andamento',
            elemento: tabela,
            botoes
        })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o item: Fale com o suporte.' })
    }

}

async function salvarRegistroChecklist(codigo) {

    try {

        overlayAguarde()

        const idOrcamento = controles?.inst?.id || controles?.conf?.id

        if (!idOrcamento)
            return popup({ mensagem: 'Falha ao localizar o orçamento: Fale com o suporte.' })

        const idLancamento = `${codigo}_${idOrcamento}`

        const detalhamento = [...document.querySelectorAll('#checklistAtivo tr')]
            .map(tr => {

                const elemento = (n) => {
                    const e = tr.querySelector(`[name="${n}"]`)
                    return n == 'realizado' ? e?.checked : e?.value
                }

                return {
                    descricao: elemento('descricao'),
                    rack: elemento('rack'),
                    local: elemento('local'),
                    pilar: elemento('pilar'),
                    setor: elemento('setor'),
                    ip: elemento('ip'),
                    realizado: elemento('realizado'),
                    data: elemento('data'),
                    observacao: elemento('observacao')
                }
            })

        await enviar(`checklist/${idLancamento}`, {
            codigo,
            id_orcamento: idOrcamento,
            detalhamento
        })

        removerTodosPopups()

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
    }

}