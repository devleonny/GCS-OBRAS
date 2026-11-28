let unidadeOrc = null
const altNumOrc = ['adm', 'analista']
// Pedido sem tipo desde 17/11/2026: o pedido é a OC do cliente e a natureza (venda/serviço) sai de cada
// rodada de faturamento (requisição e nota; gcs migrations/pedido-rodadas.sql). Pedido antigo guarda o tipo dele.
const opcoesRequisicao = ['SERVIÇO', 'VENDA', 'USO E CONSUMO', 'LOCAÇÃO']
const permAtalhos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
const permAltStatus = ['adm', 'diretoria']
const statusExclusivosLog = ['ENVIADO', 'ENTREGUE']

const esquemaBtnStatus = [
    {
        chave: 'pedidos',
        titulo: 'Novo Pedido',
        cor: '#4CAF50',
        funcao: `painelAdicionarPedido()`
    },
    {
        chave: 'requisicoes',
        titulo: 'Requisição de Materiais',
        cor: '#B12425',
        funcao: `formularioRequisicao()`
    },
    {
        chave: 'notas',
        titulo: 'Notas',
        cor: '#ff4500',
        funcao: null  // só consulta (24/11/2026): notas entram pela emissão do GCS ou por importação
    },
    {
        chave: 'parceiros',
        titulo: 'LPU Parceiro',
        cor: '#0062d5',
        funcao: `formularioParceiro()`
    },
    {
        chave: 'levantamentos',
        titulo: 'Levantamentos',
        cor: '#222',
        funcao: `formDocAdicional('LEVANTAMENTO')`
    }
    ,
    {
        chave: 'finalizado',
        titulo: 'Finalizações',
        cor: '#222',
        funcao: `formDocAdicional('FINALIZADO')`
    }

]

const botaoAnexoStatus = ({ id, cor, tabela }) => {

    return `
        <div class="contorno-botoes" style="background-color: ${cor}">
            <img src="imagens/anexo2.png" style="width: 1.5rem;">
            <label>Anexo
                <input type="file" style="display: none;" onchange="salvarAnexo('${id}', '${tabela}', this)" multiple>  
            </label>
        </div>
    `
}

const botaoFotoStatus = ({ id, cor, tabela }) => {

    return `
        <div onclick="painelFotos('${id}', '${tabela}')" class="contorno-botoes" style="background-color: ${cor}">
            <img src="imagens/camera2.png" style="width: 1.5rem;">
            <label>Foto</label>
        </div>
    `
}

const botaoEditarStatus = ({ id, cor, funcao }) => {

    return `
        <div style="background-color: ${cor};" 
            class="contorno-botoes" onclick="${funcao}">
            <img src="imagens/editar4.png" style="width: 1.5rem;">
            <label>Editar</label>
        </div>
    `
}

const blocoAnexosCompleto = ({ id, tabela, anexos }) => {

    const stringAnexos = Object.entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${id}', '${tabela}', '${idAnexo}', 'anexos')`))
        .join('')

    return `
        <div style="${vertical};">
            ${stringAnexos}
        </div>
    `
}

const blocoFotosCompleto = ({ id, tabela, fotos }) => {

    const stringFotos = Object.entries(fotos || {})
        .map(([idFoto, { link }]) => `
        <div style="position: relative;">
            <img onclick="excluirAnexo('${id}', '${tabela}', '${idFoto}', 'fotos')" src="imagens/cancel.png" style="position: absolute; top: 2px; right: 2px; width: 1.5rem;">
            <img class="foto-status" id="${idFoto}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${idFoto}')">
        </div>
        `)
        .join('')

    return `
        <div style="display: flex; flex-wrap: wrap; gap: 3px;">
            ${stringFotos}
        </div>
    `
}

// clicou: veio do clique na opção (ao abrir o formulário não alerta).
function marcarStatusPedido() {

    const opcao = [...document.querySelectorAll('[name="status-pedido"]:checked')][0]

    if (!opcao)
        return

    const pedido = document.getElementById('pedido')
    const retorno = opcao.dataset.campo
    pedido.readOnly = true
    pedido.value = retorno

    if (retorno.includes('número')) {
        // Voltando para "com número" num pedido que já tem número: mantém o que estava.
        pedido.value = pedido.dataset.numero || ''
        pedido.readOnly = false
    }

    const pendente = retorno === PEDIDO_PROMETIDO
    const aviso = document.getElementById('aviso-promessa')
    if (aviso) aviso.style.display = pendente ? '' : 'none'

    // No pedido pendente, mantém visíveis apenas o status e este aviso.
    for (const seletor of ['#departamento', '#pedido', '#valor', '#linha-oc-pedido', '#empresa', '#limite_faturamento_dia', '#condicao_pedido', '#comentario_status']) {
        const campo = document.querySelector(seletor)
        const linha = campo?.closest('.linha-padrao')
        if (linha) linha.style.display = pendente ? 'none' : ''
    }

    const linhaOc = document.getElementById('linha-oc-pedido')?.closest('.linha-padrao')
    if (linhaOc && !pendente) linhaOc.style.display = retorno.includes('número') ? '' : 'none'

}

// Pedido pendente: pode ser lançado sem dados comerciais; o GCS cobra depois para completar o pedido do cliente.
// Enquanto for promessa, a nota do orçamento não é emitida e o orçamento não é concluído.
const PEDIDO_PROMETIDO = 'Pedido pendente'
// Formulário do pedido aberto: OCs que o orçamento já tem (gcs /fluxo-itens/saldo → pedidos).
let estadoFormPedido = null
// Igual a fluxo_norm_pedido do banco: só letras e números, maiúsculo, sem zeros à esquerda.
const normPedidoCliente = t => String(t || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/^0+/, '')
const ehPromessaPedido = (situacao, valor) =>
    ['sem pedido', 'pedido pendente', ''].includes(String(situacao || '').trim().toLowerCase()) || !(Number(valor) > 10)

function avisoValorPedido(valor, totalOrcamento) {
    const total = Number(totalOrcamento) || 0
    if (!(valor > 0)) return ''
    if (total <= 10)
        return `O orçamento está com ${dinheiro(total)}: ainda não tem preço.<br><br>
            Se o cliente ainda não mandou a OC, marque <b>Pedido pendente</b> (o GCS cobra a OC depois).
            Se a OC chegou, precifique o orçamento antes de lançar o pedido.`
    if (Math.abs(valor * 1000 - total) <= Math.max(1, total * 0.01))
        return `O pedido ficou com ${dinheiro(valor)} e o orçamento é de ${dinheiro(total)}.<br><br>
            Parece que o ponto de milhar virou decimal: o valor certo não seria <b>${dinheiro(valor * 1000)}</b>?`
    if (valor < total * 0.05)
        return `O pedido (${dinheiro(valor)}) é menos de 5% do orçamento (${dinheiro(total)}).<br><br>
            Confira o valor. Se a OC cobre só uma parte, tudo bem: o restante fica como "sem pedido".`
    return ''
}

async function painelAdicionarPedido(id = crypto.randomUUID()) {

    overlayAguarde()

    const registro = await recuperarDado('pedidos', id) || {}
    const { pedido, valor, comentario, pagamento, departamento, condicao_pagamento } = registro
    let { empresa, limite_faturamento_dia } = registro
    const depAtivo = controles?.ocorrencias?.ativo

    if (!departamento && !depAtivo)
        return mensagem({ mensagem: 'Departamento não localizado' })

    // Ponte (gcs /condicao-pagamento-empresa), só no que o pedido ainda não tem: condição de pagamento
    // (pedido antigo: o texto "3x" / "30 dias") e empresa a faturar vêm dos Dados do Cliente do
    // orçamento e, sem eles, do cadastro da empresa do cliente; o limite de faturamento, da empresa.
    let condicao = normalizarCondicaoPag(condicao_pagamento) || normalizarCondicaoPag(pagamento)
    const doOrcamento = [], daEmpresaCampos = []
    let nomeEmpresaCliente = ''
    if (!condicao || !empresa || limite_faturamento_dia == null) {
        const ponte = await condicaoPagamentoEmpresa(departamento || depAtivo) || {}
        nomeEmpresaCliente = ponte.nome || ''
        if (!condicao && ponte.orcamento?.condicao) {
            condicao = ponte.orcamento.condicao
            doOrcamento.push('condição de pagamento')
        } else if (!condicao && ponte.condicao) {
            condicao = ponte.condicao
            daEmpresaCampos.push('condição de pagamento')
        }
        if (!empresa && ponte.orcamento?.empresa_faturamento) {
            empresa = ponte.orcamento.empresa_faturamento
            doOrcamento.push('empresa a faturar')
        } else if (!empresa && ponte.empresa_faturamento) {
            empresa = ponte.empresa_faturamento
            daEmpresaCampos.push('empresa a faturar')
        }
        if (limite_faturamento_dia == null && ponte.limite_faturamento_dia) {
            limite_faturamento_dia = ponte.limite_faturamento_dia
            daEmpresaCampos.push('limite de faturamento')
        }
    }
    const origemCondicao = [
        doOrcamento.length ? `Do orçamento: ${doOrcamento.join(', ')}.` : '',
        daEmpresaCampos.length ? `Do cadastro da empresa ${nomeEmpresaCliente}: ${daEmpresaCampos.join(', ')}.` : ''
    ].filter(Boolean).join(' ')
    condicao = { ...(condicao || { modo: 'MESES', parcelas: 1, base: 'EMISSAO' }) }
    if (!condicao.forma) condicao.forma = '15'

    // Situação salva → opção marcada ("Sem Pedido" antigo = promessa; número = "com número").
    const situacao = String(pedido || '').trim()
    const marcada = !registro.id ? '' : /^(sem pedido|pedido pendente)$/i.test(situacao) || !situacao ? PEDIDO_PROMETIDO
        : /e-?mail/i.test(situacao) ? 'Aprovado por E-mail' : 'Aprovado com número'
    const eraPromessa = !!registro.id && ehPromessaPedido(situacao, valor)
    const temAnexo = Object.keys(registro.anexos || {}).length > 0
    const opcoes = [PEDIDO_PROMETIDO, 'Aprovado por E-mail', 'Aprovado com número']
        .map(op => `
            <div style="${horizontal}; gap: 1rem;">
                <input ${op == marcada ? 'checked' : ''} name="status-pedido" data-campo="${op}" type="radio" style="box-shadow: none; width: 2rem; height: 2rem;" onclick="marcarStatusPedido()">
                <span>${op}</span>
            </div>
            `)
        .join('')
    // As OCs já lançadas servem para recusar a mesma OC duas vezes.
    const saldoOrc = await apiModuloFiscal('fluxo-itens/saldo', { contrato: departamento || depAtivo }).catch(() => null)
    estadoFormPedido = { id, outros: (saldoOrc?.pedidos || []).filter(p => p.id !== id), total: Number(saldoOrc?.total_orcamento) || 0 }
    let valorInicial = Number(valor) > 10 ? valor : ''

    const linhas = [
        {
            texto: 'Departamento',
            elemento: `<input id="departamento" value="${departamento || depAtivo}" readOnly>`
        },
        {
            texto: 'Status do Pedido',
            elemento: `
            <div style="${vertical}; gap: 5px;">
                ${opcoes}
                <small id="aviso-promessa" style="display: none; color: #b45309; max-width: 26rem; text-align: left;">
                    Sem o pedido do cliente por enquanto. Pode deixar os dados comerciais em branco; o GCS vai cobrar você
                    (e o gestor) para completar o pedido depois. A nota deste orçamento não sai antes disso.
                </small>
                <small style="color: #6b7a71; max-width: 26rem; text-align: left;">
                    Não vai ter OC porque é POC/demonstração, garantia ou uso interno? Não lance pedido: use
                    "Liberar sem pedido" no Histórico do orçamento.
                </small>
            </div>`
        },
        {
            texto: 'Número do Pedido',
            elemento: `<input type="text" id="pedido" value="${escaparAtributo(pedido || '')}" data-numero="${marcada === 'Aprovado com número' ? escaparAtributo(situacao) : ''}" readOnly>`
        },
        {
            texto: 'Valor do Pedido',
            elemento: `<input type="number" id="valor" min="0" step="0.01" value="${valorInicial}">`
        },
        {
            texto: 'OC do cliente (anexo)',
            elemento: `
            <div id="linha-oc-pedido" style="${vertical}; gap: 2px; width: 100%;" data-era-promessa="${eraPromessa ? 'S' : 'N'}" data-tem-anexo="${temAnexo ? 'S' : 'N'}">
                <input type="file" id="oc_pedido" multiple>
                <small style="color: #6b7a71;">${temAnexo ? 'Este pedido já tem anexo. Envie outro só se quiser acrescentar.' : eraPromessa ? 'Obrigatório para completar o pedido pendente.' : 'Opcional.'}</small>
            </div>`
        },
        {
            texto: 'Empresa a faturar',
            elemento: `
                <select id="empresa">
                    <option value="" ${empresas.includes(empresa) ? '' : 'selected'}>Selecione</option>
                    ${EMPRESAS_FATURAMENTO.filter(([v]) => empresas.includes(v))
                        .map(([v, t]) => `<option value="${v}" ${empresa == v ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Limite de faturamento (dia)',
            elemento: `
            <div style="${vertical}; gap: 2px; width: 100%;">
                <input type="number" id="limite_faturamento_dia" min="1" max="31" step="1" inputmode="numeric" placeholder="Sem limite"
                    value="${escaparAtributo(limite_faturamento_dia ?? '')}" oninput="this.nextElementSibling.textContent = textoLimiteFaturamento(this.value)">
                <small style="color: #6b7a71;">${escaparAtributo(textoLimiteFaturamento(limite_faturamento_dia))}</small>
            </div>
            `
        },
        {
            // Condição completa: vai para a NF-e (duplicatas com os vencimentos) e para as faturas a receber.
            texto: 'Condição de pagamento',
            elemento: `
            <div style="${vertical}; gap: 3px; width: 100%;" id="condicao_pedido">
                ${htmlCondicaoPag(condicao)}
            </div>
            ${origemCondicao ? `<small style="color: #6b7a71;">${escaparAtributo(origemCondicao)}</small>` : ''}
            `
        },
        {
            texto: 'Comentário',
            elemento: `<textarea rows="5" id="comentario_status">${comentario || ''}</textarea>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            funcao: `salvarPedido('${id}')`,
            img: 'concluido'
        }
    ]

    popup({ linhas, botoes, titulo: 'Novo Pedido' })
    marcarStatusPedido()
    iniciarCondicoesPag(document.getElementById('condicao_pedido'))

}

// Condição padrão da empresa do cliente faturado do departamento (gcs: /condicao-pagamento-empresa).
async function condicaoPagamentoEmpresa(departamento) {
    if (!departamento) return null
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const r = await fetch(`${api}/condicao-pagamento-empresa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ departamento })
        })
        return r.ok ? await r.json() : null
    } catch {
        return null
    }
}

async function salvarPedido(id) {

    try {
        overlayAguarde()

        const departamento = document.getElementById('departamento').value
        const comentario_status = document.getElementById('comentario_status')
        const valor = document.getElementById('valor')
        const pedido = document.getElementById('pedido')
        const empresa = document.getElementById('empresa')
        const linhaOc = document.getElementById('linha-oc-pedido')
        const arquivosOc = document.getElementById('oc_pedido')

        if (!pedido.value)
            return popup({ mensagem: 'Selecione o status do pedido.' })

        const pendente = pedido.value === PEDIDO_PROMETIDO

        // Pedido pendente aceita só o status; os dados comerciais ficam para quando o pedido for completado.
        if (!pendente && !(Number(valor.value) > 10))
            return popup({ mensagem: 'Informe o valor do pedido (acima de R$ 10).' })

        // Valor que não bate com o orçamento (22/11/2026): ponto de milhar digitado como decimal (12.333 → R$ 12,33),
        // orçamento sem preço (R$ 1 só para abrir chamado) ou pedido muito abaixo do orçamento. Avisa e deixa salvar.
        const avisoValor = pendente ? '' : avisoValorPedido(Number(valor.value), estadoFormPedido?.total)
        if (avisoValor) {
            const seguir = await confirmarPopup({ titulo: 'Confira o valor do pedido', mensagem: avisoValor, textoConfirmar: 'Salvar assim mesmo' })
            if (!seguir) return
            overlayAguarde()
        }

        // Cumprindo a promessa com número: a OC do cliente vai anexada.
        const comNumero = !ehPromessaPedido(pedido.value, valor.value) && !/e-?mail/i.test(pedido.value)
        if (comNumero && linhaOc?.dataset.eraPromessa === 'S' && linhaOc?.dataset.temAnexo !== 'S' && !arquivosOc?.files?.length)
            return popup({ mensagem: 'Anexe a OC (pedido de compra) do cliente para completar o pedido pendente.' })

        // Uma OC = um pedido (17/11/2026): a mesma OC não entra duas vezes no orçamento (antes era lançada uma vez
        // por tipo). Venda e serviço da mesma OC saem como rodadas do mesmo pedido.
        const repetida = comNumero && (estadoFormPedido?.outros || []).find(p => normPedidoCliente(p.numero) && normPedidoCliente(p.numero) === normPedidoCliente(pedido.value))
        if (repetida)
            return popup({ mensagem: `A OC ${escaparAtributo(pedido.value)} já está lançada neste orçamento. Edite o pedido existente (valor total da OC): venda e serviço saem como rodadas do mesmo pedido.` })

        // Sem empresa pré-escolhida: antes vinha AC e o pedido saía como AC sem ninguém decidir.
        if (!pendente && !empresa.value)
            return popup({ mensagem: 'Escolha a empresa a faturar.' })

        const leituraCondicao = lerCondicaoPag(document.querySelector('#condicao_pedido [data-condicao-pag]'))
        const condicao = leituraCondicao.condicao
        if (!pendente && leituraCondicao.erros.length)
            return popup({ mensagem: `Condição de pagamento: ${leituraCondicao.erros[0]}` })

        const limiteTexto = document.getElementById('limite_faturamento_dia').value
        const limite_faturamento_dia = pendente || limiteTexto === '' ? null : Number(limiteTexto)
        if (!pendente && limite_faturamento_dia !== null && !(Number.isInteger(limite_faturamento_dia) && limite_faturamento_dia >= 1 && limite_faturamento_dia <= 31))
            return popup({ mensagem: 'Limite de faturamento: informe um dia de 1 a 31, ou deixe vazio.' })

        const dados = {
            departamento,
            data: dataServidor().toLocaleString(),
            executor: acesso.usuario,
            comentario: comentario_status.value,
            // "pagamento" segue com o nº de vezes (telas e relatórios antigos); a condição completa vai junto.
            pagamento: !pendente && condicao ? String(vezesCondicaoPag(condicao)) : '',
            condicao_pagamento: pendente ? null : condicao || null,
            limite_faturamento_dia,
            valor: pendente || !valor.value ? null : Number(valor.value),
            pedido: pedido.value,
            empresa: pendente ? null : empresa.value || null
        }

        await enviar(`pedidos/${id}`, dados)

        if (arquivosOc?.files?.length) {
            const anexos = await importarAnexos({ input: arquivosOc })
            if (Array.isArray(anexos))
                await Promise.all(anexos.map(anexo => enviar(`pedidos/${id}/anexos/${crypto.randomUUID()}`, anexo)))
        }

        // Cobrança atualizada (some do contador/janela quando o pedido deixa de ser promessa).
        if (typeof verificarPedidosPrometidos === 'function') setTimeout(() => verificarPedidosPrometidos({ silencioso: true }), 1500)

        removerPopup()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao salvar o pedido: Fale com o suporte.' })
    }

}

async function abrirAtalhos(id) {

    try {

        overlayAguarde()

        const orcamento = await recuperarDado('mvw_dados_orcamentos', id) || {}
        const emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
        const botoesDisponiveis = []
        const { executor: autorizados, contrato } = orcamento.dados_orcam || {}

        // Gambiarra para não mudar a posição das paradas;
        if (!emAnalise)
            botoesDisponiveis.push(
                modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`),
                modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${contrato}')`),
                modeloBotoes('pdf', 'Abrir Orçamento em PDF', `irPdf('${id}')`),
                modeloBotoes('excel', 'Baixar Orçamento em Excel', `irExcelOrcamento('${id}')`),
                modeloBotoes('LG', 'OS em PDF', `carregarOS('${id}')`)
            )

        // Vinculados;
        const [estaVinculado, pesqMaster] = await Promise.all([
            recuperarDado('contratos_vinculados', contrato),
            pesquisarDB({ base: 'contratos_vinculados', filtros: { 'master': { op: '=', value: contrato } } })
        ])

        let avisoMaster = ''

        if (estaVinculado) {
            botoesDisponiveis.push(modeloBotoes('imagens/desvincular.svg', 'Desvincular Orçamento', `confirmarRemoverVinculo('${contrato}')`))
        } else if (!pesqMaster.resultados.length) {
            botoesDisponiveis.push(modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${contrato}')`))
        } else {

            const slaves = pesqMaster.resultados
                .map(res => `<span class="tag-vinculado slave">${res.slave}</span>`)
                .join('')

            avisoMaster = `
            <hr>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="text-align: left; width: 400px;">Este orçamento é <b>master</b>, ele não pode ser vinculado a ninguém. 
                <br>A não ser que estes filhos sejam desvinculados...</span>
                ${slaves}
            </div>
            `
        }

        botoesDisponiveis.push(
            modeloBotoes('duplicar', 'Duplicar Orçamento', `confirmarDuplicarOrcamento('${id}')`)
        )

        if (orcamento?.usuario == acesso.usuario || permAtalhos.includes(acesso.permissao) || (autorizados || []).includes(acesso.usuario)) {
            botoesDisponiveis.push(
                modeloBotoes('apagar', 'Excluir Orçamento', `confirmarExclusaoOrcamentoBase('${id}')`),
                modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`),
                modeloBotoes('gerente', 'Editar Dados do Cliente', `painelClientes('${id}')`)
            )
        }

        const aviso = emAnalise
            ? `
                <div style="${horizontal}; gap: 1rem; padding: 1rem;">
                    <img src="gifs/alerta.gif">
                    <span>Este orçamento precisa ser aprovado!</span>
                </div>`
            : ''

        const acumulado = `
                <div style="${vertical}; gap: 2px;">
                    ${(orcamento?.contrato || []).map(d => `<span>${d}</span>`).join('')}
                </div>
                <hr>
                ${aviso}
                <div class="opcoes-orcamento">${botoesDisponiveis.join('')}</div>
                ${avisoMaster}
    `

        // Um atalho por orçamento: reabrir (ou recarregar depois de salvar) atualiza a janela DESTE
        // orçamento; outro orçamento abre a sua própria janela (antes sobrescrevia a que estivesse aberta).
        const menuOpcoesOrcamento = document.querySelector(`.menu-opcoes-orcamento[data-orcamento="${CSS.escape(id)}"]`)

        if (menuOpcoesOrcamento) {
            menuOpcoesOrcamento.innerHTML = acumulado
            removerOverlay()
            trazerJanelaParaFrente(menuOpcoesOrcamento)
        } else {
            const identificacao = contrato && contrato !== 'sequencial' ? ` · ${contrato}` : ''
            popup({ elemento: `<div class="menu-opcoes-orcamento" data-orcamento="${escaparAtributo(id)}">${acumulado}</div>`, titulo: `Opções do Orçamento${identificacao}` })
            // Vencido e ainda sem centro de custo: pergunta (por cima das opções) se quer estender.
            perguntarProrrogacaoOrcamento(id, orcamento)
        }

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao abrir os atalhos: Fale com o suporte.' })
    }

}

async function confirmarProspeccao(id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `iniciarChamadoProspeccao('${id}')` }
    ]

    popup({ botoes, imagem: 'imagens/prospeccao.png', mensagem: 'Criar uma prospecção?', removerAnteriores: true, modal: true })

}

async function iniciarChamadoProspeccao(id) {

    overlayAguarde()

    const { dados_orcam } = await recuperarDado('dados_orcamentos', id) || {}
    const { omie_cliente, contrato } = dados_orcam || {}

    const existente = await chamadoDoOrcamento(contrato)
    if (existente?.vinculadoA && existente.excluido == null)
        return popup({ mensagem: `Este orçamento é vinculado ao chamado ${escaparAtributo(existente.vinculadoA)}: o fluxo dele anda na aba ${escaparAtributo(contrato)} desse chamado.` })
    if (existente?.excluido != null) {
        popup({ mensagem: `O chamado ${escaparAtributo(contrato)} deste orçamento foi excluído. Restaure o chamado antes de continuar.` })
        return
    }

    const novo = {
        id: contrato,
        unidade: omie_cliente,
        sistema: '17', // SERVIÇO DE INFRA
        prioridade: 'v2ttQ', // Serviço de INFRA
        tipo: 'wgVdc', // Prospecção
        descricao: `Chamado de Prospecção do ${contrato}`,
        data_registro: dataServidor().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
    }

    await enviar(`dados_ocorrencias/${contrato}`, novo)

    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros ??= {}
    controles.ocorrencias.filtros = {
        'chamados': { op: 'includes', value: contrato }
    }

    await telaOcorrencias()

}

async function vincularOrcamento(contratoSlave) {

    // Um "Vincular orçamentos" por vez: confirmarVinculo lê [name="orcamento"] da página e a lista
    // de escolha (controlesCxOpcoes.orcamento) é uma só.
    const vinculoAberto = document.querySelector('[name="orcamento"][data-slave]')
    if (vinculoAberto) {
        trazerJanelaParaFrente(vinculoAberto)
        if (vinculoAberto.dataset.slave !== contratoSlave)
            popup({ mensagem: `Já existe um <b>Vincular orçamentos</b> aberto para o ${escaparAtributo(vinculoAberto.dataset.slave)}.<br>Conclua ou feche esse antes de abrir outro.` })
        return
    }

    overlayAguarde()

    // mvw_dados_orcamentos (a mesma da tela de orçamentos) já traz cliente, cidade e responsáveis;
    // dados_orcamentos não tem esses campos em snapshots, e as linhas vinham em branco.
    controlesCxOpcoes.orcamento = {
        base: 'mvw_dados_orcamentos',
        retornar: ['dados_orcam.contrato'],
        colunas: {
            'Orçamento': { chave: 'dados_orcam.contrato' },
            'Cliente': { chave: 'cliente' },
            'Cidade': { chave: 'cidade' },
            'Responsáveis': { chave: 'responsaveis' }
        }
    }

    const linhas = [
        {
            texto: 'Escolha o orçamento para vincular',
            elemento: `<span class="opcoes" data-slave="${contratoSlave}" name="orcamento" onclick="cxOpcoes('orcamento')">Selecione</span>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao: `confirmarVinculo()`
        }
    ]

    popup({ linhas, botoes, titulo: `Vincular orçamentos · ${contratoSlave}` })

}

async function confirmarVinculo() {

    try {

        overlayAguarde()

        const contratos = document.querySelector('[name="orcamento"]')
        const master = contratos?.textContent
        const slave = contratos.dataset.slave

        if (master == 'Selecione')
            return popup({ mensagem: 'Escolha um orçamento' })

        if (master == slave)
            return popup({ mensagem: 'Os orçamentos são iguais!' })

        const { mensagem = 'Falha ao vincular: Fale com o suporte.' } = await enviarVinculo({ master, slave })

        removerTodosPopups()

        popup({ mensagem })

    } catch (err) {

        console.error(err)
        popup({ mensagem: 'Falha ao abrir a ferramenta: Fale com o suporte.' })

    }

}

async function confirmarRemoverVinculo(contrato) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `desfazerVinculo('${contrato}')` }
    ]

    popup({ botoes, mensagem: 'Deseja desfazer vínculo?', })

}

async function desfazerVinculo(contrato) {

    try {

        removerTodosPopups()

        overlayAguarde()

        const { mensagem } = await enviarVinculo({ slave: contrato, desvincular: true })

        if (mensagem)
            return popup({ mensagem })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao desvincular o orçamento: Fale com o suporte.' })
    }

}

async function arquivarOrcamento(id) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)

    const arquivamento = orcamento?.arquivado == 'S' ? 'N' : 'S'
    await enviar(`dados_orcamentos/${id}/arquivado`, arquivamento)

    removerOverlay()

    const img = orcamento.arquivado
        ? 'desarquivar'
        : 'pasta'

    const mensagem = orcamento.arquivado
        ? 'Arquivado com sucesso!'
        : 'Desarquivado com sucesso!'

    popup({ mensagem, imagem: `imagens/${img}.png` })

}

function divPorcentagem(porcentagem) {
    const valor = Math.max(
        0,
        Number(porcentagem) || 0
    )

    const largura = Math.min(valor, 100)

    const cor =
        valor > 100
            ? '#2196f399'
            : valor >= 70
                ? '#7ee182'
                : valor >= 40
                    ? '#ffc107'
                    : '#f44336'

    return `
        <div class="div-porcentagem">
            <div
                style="
                    width: ${largura}%;
                    height: 100%;
                    background: ${cor};
                "
            ></div>

            <label
                style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 0.7rem;
                    color: #000;
                "
            >
                ${valor}%
            </label>
        </div>
    `
}

async function consultarChamadoOrcamento(contrato) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${read}/estado-chamado`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contrato: String(contrato || '') }),
        signal: AbortSignal.timeout(15000)
    })
    if (!resposta.ok)
        throw new Error('Não foi possível verificar o estado do chamado. Confirme se o serviço de leitura foi atualizado.')
    const resultado = await resposta.json()
    if (resultado.estado === 'inexistente') return null
    if (resultado.estado === 'excluido') return { id: resultado.id, excluido: resultado.excluido }
    if (resultado.estado !== 'ativo') throw new Error('Estado do chamado inválido.')
    const chamado = await recuperarDado('dados_ocorrencias', contrato)
    if (!chamado?.id) throw new Error('Não foi possível carregar o chamado existente. Tente novamente.')
    return chamado
}

// Chamado que o orçamento usa: o do master quando é vinculado (o chamado próprio do vinculado sai
// excluído "Vinculado ao chamado ..."; o fluxo dele anda numa aba do chamado master). Volta com vinculadoA.
async function chamadoDoOrcamento(contrato) {
    const { master } = await recuperarDado('contratos_vinculados', contrato).catch(() => null) || {}
    if (master && master !== contrato) {
        const chamadoMaster = await consultarChamadoOrcamento(master)
        if (chamadoMaster) return { ...chamadoMaster, vinculadoA: master }
    }
    return consultarChamadoOrcamento(contrato)
}

async function checklistChamado(id, chamadoConsultado = undefined) {

    const contrato = controles.ocorrencias.ativo

    // Para abrir transformar um orcamento em chamado, ele precisa ter um pedido (Enviado e Aprovado);
    const existente = chamadoConsultado === undefined
        ? await chamadoDoOrcamento(contrato)
        : chamadoConsultado
    const idChamado = existente?.vinculadoA || contrato

    const pChamado = existente?.excluido != null
        ? `<div role="status"><strong>Chamado excluído</strong><p>O chamado ${escaparAtributo(idChamado)} deste orçamento foi excluído. É necessário restaurá-lo antes de voltar a utilizá-lo.</p></div>`
        : existente
        ?
        `
                <div class="chamado-aberto">
                    <img src="imagens/concluido.png">
                    <span>${existente.vinculadoA
                        ? `Vinculado ao chamado > ${escaparAtributo(idChamado)} <small>(aba ${escaparAtributo(contrato)})</small>`
                        : `Chamado já aberto > ${contrato}`}</span>
                </div>
            `
        : `
        <button onclick="auxAberturaChamado('${id}')">Abrir Chamado</button>
        <button onclick="confirmarProspeccao('${id}')">Chamado Prospecção</button>
    `

    const local = [...document.querySelectorAll('.status-check-ocorrencias')].pop()

    if (local)
        local.innerHTML = pChamado

}

async function auxAberturaChamado(id) {

    overlayAguarde()

    const { dados_orcam } = await recuperarDado('dados_orcamentos', id) || {}
    const { contrato, omie_cliente } = dados_orcam || {}

    const existente = await chamadoDoOrcamento(contrato)
    if (existente?.vinculadoA && existente.excluido == null)
        return popup({ mensagem: `Este orçamento é vinculado ao chamado ${escaparAtributo(existente.vinculadoA)}: o fluxo dele anda na aba ${escaparAtributo(contrato)} desse chamado.` })
    if (existente?.excluido != null) {
        popup({ mensagem: `O chamado ${escaparAtributo(contrato)} deste orçamento foi excluído. Restaure o chamado antes de continuar.` })
        return
    }

    const pedidos = await pesquisarDB({
        base: 'pedidos',
        filtros: {
            'departamento': {
                op: 'codigo',
                value: contrato
            }
        }
    })

    // Sem pedido: lote ou liberação sem pedido (POC, garantia, uso interno) também liberam o chamado.
    if (!pedidos.resultados.length) {
        const lib = await apiModuloFiscal('fluxo-itens/liberacao', { orcamento_id: id }).catch(() => null)
        if (!lib?.liberado) return avisoSemLiberacao(id, 'chamado')
    }

    unidadeOrc = omie_cliente

    await formularioOcorrencia(contrato)

}

// ---- Liberação do orçamento (gcs /fluxo-itens/liberacao, 22/11/2026) ----
// O que deixa abrir chamado e criar requisição: o pedido do cliente (OC, e-mail ou pendente), o lote ou uma
// liberação sem pedido com motivo (POC/demonstração, garantia, uso interno). Liberação não é OC: não entra
// no saldo a faturar. A requisição de um orçamento liberado sai num cartão próprio (remessa).

// Sem nada que libere: lançar o pedido ou liberar sem pedido. depois = 'chamado' | 'requisicao' (continua).
function avisoSemLiberacao(orcamentoId, depois) {
    const acao = depois === 'requisicao' ? 'criar a requisição' : 'abrir o chamado'
    popup({
        titulo: 'Orçamento sem pedido',
        mensagem: `Para ${acao}, lance o pedido do cliente (OC, aprovado por e-mail ou pedido pendente).<br><br>
            Sem OC porque é POC/demonstração, garantia ou uso interno? Libere sem pedido, com o motivo: o material sai como remessa e não conta como faturamento.`,
        botoes: [
            { texto: 'Lançar pedido', img: 'concluido', fechar: true, funcao: 'painelAdicionarPedido()' },
            { texto: 'Liberar sem pedido', img: 'alerta', fechar: true, funcao: `formularioLiberacao('${escaparAtributo(orcamentoId)}', '${depois || ''}')` }
        ]
    })
}

let tiposLiberacaoCache = null

async function formularioLiberacao(orcamentoId, depois = '') {
    overlayAguarde()
    const lib = await apiModuloFiscal('fluxo-itens/liberacao', { orcamento_id: orcamentoId }).catch(err => ({ erro: err.message }))
    if (lib.erro) return popup({ mensagem: lib.erro })
    if (lib.liberacao) return popup({ mensagem: `Este orçamento já está liberado sem pedido (${escaparAtributo(lib.liberacao.nome)}).` })
    tiposLiberacaoCache = lib.tipos || []
    const opcoes = tiposLiberacaoCache.map((t, i) => `
        <label style="${horizontal}; gap: 0.6rem; cursor: pointer;">
            <input type="radio" name="tipo-liberacao" value="${t.tipo}" ${i === 0 ? 'checked' : ''} onchange="trocarTipoLiberacao()" style="box-shadow: none; width: 1.4rem; height: 1.4rem;">
            <span>${escaparAtributo(t.nome)}</span>
        </label>`).join('')
    const linhas = [
        { texto: 'Tipo', elemento: `<div style="${vertical}; gap: 6px; align-items: flex-start;">${opcoes}</div>` },
        { texto: 'Motivo', elemento: `<textarea id="motivo-liberacao" rows="4" maxlength="500" placeholder="Ex.: POC de 2 câmeras aprovada pelo cliente por e-mail; se aprovar, manda a OC"></textarea>` },
        { texto: 'Decidir até', elemento: `<div style="${vertical}; gap: 2px; width: 100%;"><input type="date" id="prazo-liberacao"><small id="dica-prazo-liberacao" style="color: #6b7a71;"></small></div>` }
    ]
    popup({
        titulo: 'Liberar sem pedido', linhas,
        botoes: [{ texto: 'Liberar', img: 'concluido', funcao: `salvarLiberacao('${escaparAtributo(orcamentoId)}', '${depois}')` }]
    })
    trocarTipoLiberacao()
}

function trocarTipoLiberacao() {
    const tipo = document.querySelector('[name="tipo-liberacao"]:checked')?.value
    const def = (tiposLiberacaoCache || []).find(t => t.tipo === tipo)
    const campo = document.getElementById('prazo-liberacao')
    const linha = campo?.closest('.linha-padrao')
    if (!campo) return
    if (linha) linha.style.display = def?.prazo_dias ? '' : 'none'
    if (def?.prazo_dias && !campo.value) {
        const d = dataServidor()
        d.setDate(d.getDate() + def.prazo_dias)
        campo.value = d.toISOString().slice(0, 10)
    }
    const dica = document.getElementById('dica-prazo-liberacao')
    if (dica) dica.textContent = def?.prazo_dias ? `A remessa para demonstração tem ${def.prazo_dias} dias para voltar ou virar venda.` : ''
}

async function salvarLiberacao(orcamentoId, depois) {
    const tipo = document.querySelector('[name="tipo-liberacao"]:checked')?.value
    const motivo = document.getElementById('motivo-liberacao')?.value.trim() || ''
    const def = (tiposLiberacaoCache || []).find(t => t.tipo === tipo)
    const prazo = def?.prazo_dias ? document.getElementById('prazo-liberacao')?.value || '' : ''
    if (!tipo) return popup({ mensagem: 'Escolha o tipo da liberação.' })
    if (motivo.length < 10) return popup({ mensagem: 'Explique por que este orçamento anda sem pedido (pelo menos 10 caracteres).' })
    overlayAguarde()
    try {
        await apiModuloFiscal('fluxo-itens/liberar', { orcamento_id: orcamentoId, tipo, motivo, prazo })
    } catch (err) {
        return popup({ mensagem: err.message || 'Falha ao liberar.' })
    }
    removerPopup()
    atualizarLiberacaoHistorico(orcamentoId)
    if (depois === 'chamado') return auxAberturaChamado(orcamentoId)
    if (depois === 'requisicao') return formularioRequisicao()
}

function atualizarLiberacaoHistorico(orcamentoId) {
    document.querySelectorAll(`.painel-historico[data-historico-orc="${CSS.escape(orcamentoId)}"]`)
        .forEach(p => carregarLiberacaoHistorico(p, orcamentoId))
}

async function encerrarLiberacao(id, orcamentoId) {
    const linhas = [
        {
            texto: 'Como terminou',
            elemento: `<select id="status-fim-liberacao">
                <option value="VIROU_PEDIDO">Virou pedido (o cliente mandou a OC)</option>
                <option value="DEVOLVIDO">Material devolvido</option>
                <option value="ENCERRADA">Encerrada por outro motivo</option>
            </select>`
        },
        { texto: 'Observação', elemento: `<textarea id="motivo-fim-liberacao" rows="3" maxlength="500" placeholder="Obrigatória quando não virou pedido"></textarea>` }
    ]
    popup({
        titulo: 'Encerrar liberação', linhas,
        botoes: [{ texto: 'Encerrar', img: 'concluido', funcao: `salvarFimLiberacao('${escaparAtributo(id)}', '${escaparAtributo(orcamentoId)}')` }]
    })
}

async function salvarFimLiberacao(id, orcamentoId) {
    const status = document.getElementById('status-fim-liberacao')?.value
    const motivo = document.getElementById('motivo-fim-liberacao')?.value.trim() || ''
    if (status !== 'VIROU_PEDIDO' && motivo.length < 10) return popup({ mensagem: 'Explique como terminou (pelo menos 10 caracteres).' })
    overlayAguarde()
    try {
        await apiModuloFiscal('fluxo-itens/liberacao-encerrar', { id, status, motivo })
    } catch (err) {
        return popup({ mensagem: err.message || 'Falha ao encerrar.' })
    }
    removerPopup()
    atualizarLiberacaoHistorico(orcamentoId)
}

async function carregarLiberacaoHistorico(painel, orcamentoId) {
    const local = painel?.querySelector('.historico-liberacao')
    if (!local) return
    const esc = escaparAtributo
    let lib
    try {
        lib = await apiModuloFiscal('fluxo-itens/liberacao', { orcamento_id: orcamentoId })
    } catch {
        local.innerHTML = '<span class="historico-liberacao-texto">Não foi possível consultar.</span>'
        return
    }
    const id = esc(orcamentoId)
    const etiqueta = (texto, classe = '') => `<span class="historico-liberacao-etiqueta ${classe}">${esc(texto)}</span>`
    const dataBr = d => d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : ''
    const comOc = (lib.pedidos || []).filter(p => !p.pendente)
    const partes = []

    if (comOc.length)
        partes.push(`${etiqueta('Pedido do cliente', 'ok')}<span class="historico-liberacao-texto">${comOc.map(p => esc(p.numero || 'OC')).join(', ')}</span>`)
    else if ((lib.pedidos || []).length)
        partes.push(`${etiqueta('Pedido pendente', 'pendente')}<span class="historico-liberacao-texto">Falta a OC do cliente.</span>`)
    else if (lib.lote)
        partes.push(`${etiqueta('Lote', 'lote')}<span class="historico-liberacao-texto">${esc(lib.lote.nome)}: coberto pelas OCs do lote.</span>`)

    const l = lib.liberacao
    if (l) {
        const hoje = dataServidor().toISOString().slice(0, 10)
        const vencido = l.prazo && l.prazo < hoje
        partes.push(`
            ${etiqueta(`Sem pedido · ${l.nome}`, 'sem-pedido')}
            <span class="historico-liberacao-texto" title="${esc(l.motivo)}">${esc(l.motivo)}</span>
            <small class="historico-liberacao-texto">por ${esc(l.criado_por || '')} em ${dataBr(l.criado_em)}${l.prazo ? ` · <span class="${vencido ? 'vencido' : ''}">decidir até ${dataBr(l.prazo)}${vencido ? ' (vencido)' : ''}</span>` : ''}</small>
            ${comOc.length ? '<small class="historico-liberacao-texto aviso">Chegou o pedido: encerre como "Virou pedido".</small>' : ''}
            <button type="button" onclick="encerrarLiberacao('${esc(l.id)}', '${id}')">Encerrar liberação</button>`)
    }

    if (!partes.length)
        partes.push(`${etiqueta('Sem pedido', 'nada')}<span class="historico-liberacao-texto">Chamado e requisição esperam o pedido ou uma liberação.</span>`)

    if (!l && !comOc.length)
        partes.push(`<button type="button" onclick="formularioLiberacao('${id}')">Liberar sem pedido</button>`)

    const anteriores = (lib.anteriores || []).map(a =>
        `<small class="historico-liberacao-texto" title="${esc(a.encerrado_motivo || a.motivo)}">${esc(a.nome)}: ${esc(a.status_nome)} em ${dataBr(a.encerrado_em)}</small>`).join('')

    local.innerHTML = partes.join('') + anteriores
}

async function abrirEsquema(id) {

    try {

        overlayAguarde()

        const {
            dados_orcam,
            nomes_status,
            cliente
        } = await recuperarDado('mvw_dados_orcamentos', id) || {}

        const contrato = dados_orcam?.contrato

        if (!contrato) {
            await enviar(`dados_orcamentos/${id}/excluido`, null)
            popup({ mensagem: 'O orçamento estava inacessível, tente de novo em instantes!' })
            return
        }

        controles.ocorrencias ??= {}
        controles.ocorrencias.ativo = contrato

        const chamado = await chamadoDoOrcamento(contrato)
        const statusOcorrencia = chamado?.excluido != null
            ? ['CHAMADO EXCLUÍDO']
            : !chamado ? ['CHAMADO NÃO ABERTO']
                : Array.isArray(nomes_status) && nomes_status.length
                    ? [...new Set(nomes_status.filter(Boolean))] : ['SEM STATUS']
        const labelTipoCorrecao = statusOcorrencia
            .map(st => formatacaoTipoCorrecao(st))
            .join('')

        // Visão escolhida pelo usuário (salva no perfil): 'secoes' (a de sempre) ou 'esquema'.
        const visao = await preferenciaUsuario(PREF_VISAO_HISTORICO, 'secoes') === 'esquema' ? 'esquema' : 'secoes'

        const elemento = `
            <div class="painel-historico" data-historico-orc="${escaparAtributo(id)}" data-contrato="${escaparAtributo(contrato)}" data-visao="${visao}">

                <div class="historico-cabecalho">
                    <div class="historico-identificacao">
                        <span class="historico-contrato">${escaparAtributo(contrato || '')}</span>
                        <span class="historico-cliente">${escaparAtributo(cliente || 'Cliente não informado')}</span>
                    </div>
                    <div class="historico-cabecalho-acoes">
                        <div class="historico-visao" role="radiogroup" aria-label="Visualização">
                            <button type="button" role="radio" data-visao-opcao="secoes" aria-checked="${visao === 'secoes'}"
                                onclick="trocarVisaoHistorico(this, 'secoes')" title="Pedidos, requisições, notas e demais seções lado a lado">
                                <span aria-hidden="true">▦</span> Seções
                            </button>
                            <button type="button" role="radio" data-visao-opcao="esquema" aria-checked="${visao === 'esquema'}"
                                onclick="trocarVisaoHistorico(this, 'esquema')" title="Cada pedido com as requisições e notas que nasceram dele">
                                <span aria-hidden="true">⤷</span> Esquema
                            </button>
                        </div>
                        <button class="historico-ver-status" onclick="verHistoricoStatus('${id}')">
                            <img src="imagens/historico.png" alt="">
                            Histórico de status
                        </button>
                        <button type="button" class="tour-botao" data-tour-historico onclick="iniciarTour('historico', TOUR_HISTORICO)"
                            title="Passo a passo do histórico do orçamento">${typeof iconeTour === 'function' ? iconeTour() : ''} Tour</button>
                    </div>
                </div>

                <div class="historico-resumo">
                    <div class="historico-resumo-item">
                        <label class="historico-rotulo">Chamado</label>
                        <div class="status-check-ocorrencias"></div>
                    </div>
                    <div class="historico-resumo-item">
                        <label class="historico-rotulo">Status</label>
                        <div class="historico-status-lista">${labelTipoCorrecao || '<span class="and">SEM STATUS</span>'}</div>
                    </div>
                    <div class="historico-resumo-item">
                        <label class="historico-rotulo">Liberação</label>
                        <div class="historico-liberacao"><span class="historico-liberacao-texto">Carregando…</span></div>
                    </div>
                </div>

                <div class="historico-lote" hidden></div>

                <div class="bloco-st"${visao === 'secoes' ? '' : ' hidden'}></div>
                <div class="bloco-esquema-historico"${visao === 'esquema' ? '' : ' hidden'}></div>

            </div>
        `

        // Só um histórico por vez: as tabelas das seções (modTab/paginacao) e o checklist do chamado
        // usam ids/controles fixos por página, e com dois abertos o segundo desenhava no primeiro.
        // Abrir outro substitui o anterior.
        document.querySelectorAll('body > .popup .painel-historico')
            .forEach(p => removerPopup(p.closest('.popup').id))

        const idJanela = popup({
            elemento,
            titulo: 'Histórico do Orçamento',
            etiquetaBarra: { codigo: contrato, nome: cliente },
            conteudoRodape: rodapeOrcamento(contrato, cliente || 'Cliente não informado')
        })

        // Checklist Chamado;
        await checklistChamado(id, chamado)

        const painel = document.getElementById(idJanela)?.querySelector('.painel-historico')
        carregarLoteHistorico(painel, id)
        carregarLiberacaoHistorico(painel, id)
        await carregarVisaoHistorico(painel, visao)

        // Tour do histórico (js/tour_telas.js): primeira vez de cada usuário.
        if (typeof tourPrimeiraVez === 'function') tourPrimeiraVez('historico', TOUR_HISTORICO, { atraso: 700 })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o esquema: Fale com o suporte.' })
    }


}

// Lote de orçamentos (gcs /fluxo-itens/lote): uma OC do cliente cobrindo várias lojas, cada loja com o seu
// orçamento (a tag do lote ocupa uma vaga). Referência = a proposta que guarda as OCs e as notas.
async function carregarLoteHistorico(painel, orcamentoId) {
    const local = painel?.querySelector('.historico-lote')
    if (!local) return
    const { lote } = await apiModuloFiscal('fluxo-itens/lote', { orcamento_id: orcamentoId }).catch(() => ({}))
    if (!lote) return
    const esc = escaparAtributo
    const ocs = (lote.pedidos || [])
        .map(p => `<span class="${p.saldo > 10 ? '' : 'ok'}" title="OC ${esc(dinheiroTexto(p.valor))} · faturado ${esc(dinheiroTexto(p.faturado))}">${esc(p.numero || 'OC')} ${p.saldo > 10 ? `· falta faturar ${dinheiro(p.saldo)}` : '· faturada'}</span>`)
        .join('')
    const verRef = lote.papel === 'LOJA' && lote.orcamento_ref
        ? `<button type="button" onclick="abrirEsquema('${esc(lote.orcamento_ref)}')">Ver ${esc(lote.contrato_ref || 'proposta')}</button>` : ''
    const texto = lote.papel === 'LOJA'
        ? `Esta loja ocupa uma das ${lote.vagas} vagas do lote e está coberta pelas OCs da proposta ${esc(lote.contrato_ref || '')}: não precisa de pedido nem de nota própria.`
        : `Proposta do lote: as OCs e as notas ficam aqui. Cada orçamento com a tag ${esc(lote.nome)} ocupa uma vaga; as vagas livres viram chamados e orçamentos novos.`
    local.innerHTML = `
        <div class="historico-lote-info">
            <div class="historico-lote-titulo"><span class="historico-lote-etiqueta">Lote</span><b>${esc(lote.nome)}</b></div>
            <span class="historico-lote-texto">${texto}</span>
            <div class="historico-lote-numeros">
                <span>${lote.ocupadas} de ${lote.vagas} lojas com orçamento</span>
                ${lote.excedente > 0
                    ? `<span class="alerta">${lote.excedente} além das vagas</span>`
                    : `<span class="${lote.livres ? '' : 'ok'}">${lote.livres} ${lote.livres === 1 ? 'vaga livre' : 'vagas livres'}</span>`}
                ${lote.livres ? `<span title="Vagas livres × ${esc(dinheiroTexto(lote.valor_vaga_venda))}">Venda a usar ${dinheiro(lote.saldo_venda)}</span>
                <span title="Vagas livres × ${esc(dinheiroTexto(lote.valor_vaga_servico))}">Serviço a usar ${dinheiro(lote.saldo_servico)}</span>` : ''}
                ${ocs}
            </div>
        </div>
        ${verRef}`
    local.hidden = false
}

// ---------------------------------------------------------------- Histórico: visões

const PREF_VISAO_HISTORICO = 'historico_orcamento_visao'

// Troca de visão no cabeçalho: mostra a escolhida (carrega na primeira vez) e lembra no perfil.
async function trocarVisaoHistorico(botao, visao) {
    const painel = botao.closest('.painel-historico')
    if (!painel || painel.dataset.visao === visao) return
    painel.dataset.visao = visao
    painel.querySelectorAll('[data-visao-opcao]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.visaoOpcao === visao)))
    painel.querySelector('.bloco-st').hidden = visao !== 'secoes'
    painel.querySelector('.bloco-esquema-historico').hidden = visao !== 'esquema'
    salvarPreferenciaUsuario(PREF_VISAO_HISTORICO, visao)
    await carregarVisaoHistorico(painel, visao)
}

async function carregarVisaoHistorico(painel, visao) {
    if (!painel || painel.dataset[`carregado_${visao}`]) return
    painel.dataset[`carregado_${visao}`] = '1'
    if (visao === 'esquema') return carregarEsquemaHistorico(painel)
    await carregarSecoesHistorico(painel)
}

// Visão "Seções" (a original): uma tabela por assunto filtrada pelo ORC.
async function carregarSecoesHistorico(painel) {
    const contrato = painel.dataset.contrato
    const local = painel.querySelector('.bloco-st')

    try {
        await Promise.all(
            esquemaBtnStatus
                .map(async (botao) => {

                    const {
                        chave,
                        titulo,
                        cor,
                        funcao
                    } = botao

                    const dados = {
                        base: chave,
                        body: `body_${chave}`,
                        pag: chave,
                        nude: true,
                        filtros: {
                            departamento: {
                                op: 'codigo',
                                value: contrato
                            }
                        },
                        criarLinha: `lin${inicialMaiuscula(chave)}`
                    }

                    if (chave == 'levantamentos' || chave == 'finalizado') {
                        dados.base = 'anexos'
                        dados.criarLinha = 'linAnexos'
                        dados.filtros.origem = {
                            op: '=',
                            value: chave == 'levantamentos'
                                ? 'LEVANTAMENTO'
                                : 'FINALIZADO'
                        }
                    }

                    const tabela = await modTab(dados)

                    local.insertAdjacentHTML('beforeend', `
                        <section class="historico-secao" data-secao="${chave}" style="--cor-secao: ${cor};">
                            ${funcao
                                ? `<button class="historico-secao-acao" style="background-color: ${cor};" onclick="${funcao}">${titulo}</button>`
                                : `<button type="button" class="historico-secao-acao" style="background-color: ${cor}; cursor: default;" tabindex="-1">${titulo}</button>`}
                            ${tabela}
                        </section>
                    `)

                    await paginacao(chave)
                })
        )
        await carregarNotasGcsHistorico(painel, contrato)

    } catch (err) {
        console.error(err)
        delete painel.dataset.carregado_secoes
        popup({ mensagem: 'Falha ao abrir o esquema: Fale com o suporte.' })
    }
}

// Notas emitidas pelo GCS (18/11/2026): a seção Notas lista só as do Omie; estas vêm do Fiscal
// (rota /fluxo-itens/notas-gcs) — com o ORC, com o ORC no rateio ou ligadas a um cartão dele. Com rateio, o
// valor é a parte deste orçamento e o total da nota vai embaixo.
async function carregarNotasGcsHistorico(painel, contrato) {
    const secao = painel.querySelector('.historico-secao[data-secao="notas"]')
    if (!secao || !contrato) return
    const { notas = [] } = await apiModuloFiscal('fluxo-itens/notas-gcs', { contrato }).catch(err => (console.error(err), {}))
    if (!notas.length) return
    const cor = '#ff4500'
    const situacao = { AUTORIZADA: 'Autorizada', PROCESSANDO: 'Processando', CANCELADA: 'Cancelada', DENEGADA: 'Denegada' }
    const blocos = notas.map(n => {
        const nfse = n.modelo === 'NFSE'
        const titulo = `${nfse ? 'NFS-e' : 'NF-e'} ${n.numero || '(sem número)'}`
        const rateio = n.percentual != null
            ? `${String(n.percentual).replace('.', ',')}% de ${dinheiro(n.total_nota)}`
            : ''
        return `
            <div class="bloco-status-interno" style="border: 1px solid ${cor}; background-color: ${cor}1f;${n.status === 'CANCELADA' ? ' opacity: .6;' : ''}">
                ${labelDestaque('Nota', `${titulo} · GCS${n.app ? ` · ${n.app}` : ''}`)}
                ${labelDestaque('Tipo', n.detalhe || n.tipo)}
                ${labelDestaque(n.percentual != null ? 'Valor deste orçamento' : 'Valor', dinheiro(n.total))}
                ${labelDestaque('Rateio', rateio)}
                ${labelDestaque('Data Emissão', n.data ? new Date(n.data).toLocaleDateString('pt-BR') : '')}
                ${labelDestaque('Situação', situacao[n.status] || n.status)}
                ${labelDestaque('Executor', n.executor)}
                <div class="painel-botoes">
                    <div style="background-color: ${cor};" class="contorno-botoes" onclick="abrirDocumentoFiscal('${n.id}')">
                        <img src="imagens/pdfw.png" style="width: 1.5rem;">
                        <label>Abrir nota</label>
                    </div>
                    ${n.status === 'AUTORIZADA' ? `
                    <div style="background-color: ${cor};" class="contorno-botoes" onclick="baixarArquivoFiscal('${n.id}', 'danfe')">
                        <img src="imagens/pdfw.png" style="width: 1.5rem;">
                        <label>${nfse ? 'DANFSe' : 'DANFE'}</label>
                    </div>` : ''}
                </div>
            </div>`
    }).join('')
    secao.insertAdjacentHTML('beforeend', `
        <div style="display: flex; flex-direction: column; gap: 5px; padding: 5px;">
            <b style="color: ${cor};">Emitidas pelo GCS</b>
            ${blocos}
        </div>`)
}

// Visão "Esquema": cada pedido do ORC com as requisições e notas que nasceram dele (fluxo_itens no
// servidor, rota /fluxo-itens/esquema). O que não tem pedido de origem fica de fora.
const ETAPAS_ESQUEMA_HIST = [
    ['PEDIDO', 'Pedido'], ['REQUISICAO', 'Requisição'], ['SEPARADO', 'Separado'],
    ['FATURADO', 'Faturado'], ['ENTREGUE', 'Entregue'], ['CONCLUIDO', 'Concluído']
]

async function carregarEsquemaHistorico(painel) {
    const local = painel.querySelector('.bloco-esquema-historico')
    local.innerHTML = '<div class="esq-hist-carregando">Montando o esquema…</div>'
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/fluxo-itens/esquema`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ contrato: painel.dataset.contrato })
        })
        const dados = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(dados.mensagem || `Falha (${resposta.status})`)
        local.innerHTML = htmlEsquemaHistorico(dados.itens || [])
    } catch (err) {
        delete painel.dataset.carregado_esquema
        local.innerHTML = `<div class="esq-hist-vazio">Não foi possível montar o esquema: ${escaparAtributo(err.message)}
            <button type="button" onclick="recarregarEsquemaHistorico(this)">Tentar de novo</button></div>`
    }
}

function recarregarEsquemaHistorico(botao) {
    const painel = botao.closest('.painel-historico')
    if (!painel) return
    painel.dataset.carregado_esquema = '1'
    carregarEsquemaHistorico(painel)
}

function htmlEsquemaHistorico(itens) {
    const esc = escaparAtributo
    const barra = `
        <div class="esq-hist-topo">
            <div class="esq-hist-resumo">
                <span><b>${itens.length}</b> ${itens.length === 1 ? 'pedido' : 'pedidos'}</span>
                <span>Pedidos <b>${dinheiro(itens.reduce((s, i) => s + (i.pedido.valor || 0), 0))}</b></span>
                <span>Notas <b>${dinheiro(itens.reduce((s, i) => s + i.notas.filter(n => !n.cancelada).reduce((t, n) => t + (n.total || 0), 0), 0))}</b></span>
            </div>
            <button type="button" class="esq-hist-atualizar" onclick="recarregarEsquemaHistorico(this)" title="Buscar de novo">↻ Atualizar</button>
        </div>`

    if (!itens.length)
        return `${barra}<div class="esq-hist-vazio">Nenhum pedido neste orçamento.<br><small>Requisições e notas sem pedido de origem não aparecem nesta visão; veja em Seções.</small></div>`

    const vazio = texto => `<div class="esq-no esq-no-vazio">${texto}</div>`
    // Etiqueta do tipo (pedido e nota): cor pela família, para comparar de relance o que foi pedido com o que foi faturado.
    const tipoEsq = (tipo, titulo = '') => {
        if (!tipo) return ''
        const t = String(tipo).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
        const cls = t.includes('VENDA') && t.includes('SERVICO') ? 'misto'
            : t.includes('DEVOLUCAO') ? 'devolucao'
            : t.includes('SERVICO') ? 'servico'
            : t.includes('VENDA') ? 'venda'
            : t.includes('REMESSA') || t.includes('RETORNO') ? 'remessa'
            : t.includes('LOCACAO') ? 'locacao' : 'outro'
        return `<span class="esq-tipo ${cls}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(tipo)}</span>`
    }
    const etapas = etapa => {
        const atual = ETAPAS_ESQUEMA_HIST.findIndex(([k]) => k === etapa)
        return `<ol class="esq-hist-etapas" aria-label="Etapa: ${esc(ETAPAS_ESQUEMA_HIST[atual]?.[1] || etapa)}">${ETAPAS_ESQUEMA_HIST
            .map(([, nome], i) => `<li class="${i < atual ? 'feita' : i === atual ? 'atual' : ''}">${nome}</li>`).join('')}</ol>`
    }

    // Tipo da nota vem da própria nota: Omie = categoria (venda, serviço, remessa); NF-e do GCS = tipo da
    // operação (quando o servidor manda) e NFS-e = Serviço.
    const tipoNotaEsq = n => {
        const t = String(n.tipo || n.categoria || '').trim()
        if (t) return t[0].toUpperCase() + t.slice(1).toLowerCase()
        return n.modelo === 'NFSE' ? 'Serviço' : ''
    }

    const noNota = n => {
        const gcs = n.origem === 'GCS'
        const situacao = gcs
            ? ({ AUTORIZADA: 'Autorizada', RASCUNHO: 'Rascunho', PROCESSANDO: 'Processando', REJEITADA: 'Rejeitada', CANCELADA: 'Cancelada', DENEGADA: 'Denegada' }[n.status] || n.status)
            : n.cancelada ? 'Cancelada' : ''
        const tom = n.cancelada ? 'cancelada' : gcs && n.status !== 'AUTORIZADA' ? 'pendente' : 'ok'
        const titulo = gcs
            ? `${n.modelo === 'NFSE' ? 'NFS-e' : 'NF-e'} ${n.numero ? esc(n.numero) : '(sem número)'}`
            : `NF ${esc(n.numero || '—')}`
        const data = gcs && n.data ? new Date(n.data).toLocaleDateString('pt-BR') : esc(n.data || '')
        const acao = gcs ? `abrirDocumentoFiscal('${esc(n.id)}')` : `abrirDANFE('${esc(n.id)}')`
        return `
            <button type="button" class="esq-no esq-no-nota ${tom}" onclick="${acao}" title="${gcs ? 'Abrir a nota' : 'Abrir o DANFE'}">
                <span class="esq-no-cabeca">
                    ${tipoEsq(tipoNotaEsq(n) || 'Tipo não informado', n.detalhe)}
                    <span class="esq-no-tipo">${gcs ? 'GCS' : 'Omie'}${n.app ? ` · ${esc(n.app)}` : ''}</span>
                </span>
                <b>${titulo}</b>
                ${n.detalhe && n.detalhe !== n.tipo ? `<span class="esq-no-quem">${esc(n.detalhe)}</span>` : ''}
                ${n.percentual != null ? `<span class="esq-no-quem">Rateio ${esc(String(n.percentual).replace('.', ','))}% de ${dinheiro(n.total_nota || 0)}</span>` : ''}
                <span class="esq-no-linha"><span>${data}</span><b>${dinheiro(n.total || 0)}</b></span>
                ${situacao ? `<span class="esq-no-situacao">${esc(situacao)}</span>` : ''}
            </button>`
    }

    const noRequisicao = r => `
        <button type="button" class="esq-no esq-no-req" onclick="gerarPdfRequisicao('${esc(r.id)}', true)" title="Visualizar a requisição">
            <span class="esq-no-cabeca">
                <span class="esq-no-tipo">Requisição</span>
                ${r.avulso ? '<span class="esq-tipo avulsa">Avulsa</span>' : ''}
            </span>
            <b>${r.itens} ${r.itens === 1 ? 'item' : 'itens'}</b>
            <span class="esq-no-linha"><span>${esc(String(r.data).slice(0, 10))}</span><b>${dinheiro(r.total || 0)}</b></span>
            ${r.executor ? `<span class="esq-no-quem">${esc(r.executor)}</span>` : ''}
        </button>`

    const cadeias = itens.map(i => {
        const p = i.pedido
        const verde = i.emissao_status === 'OK' || i.notas.some(n => !n.cancelada && (n.origem === 'OMIE' || n.status === 'AUTORIZADA'))
        return `
            <article class="esq-cadeia${verde ? ' faturada' : ''}${i.emissao_status === 'ERRO' ? ' erro' : ''}">
                <header class="esq-cadeia-topo">
                    <span class="esq-cadeia-titulo">Pedido ${esc(p.numero || 'sem número')}${i.rodada != null ? ` <small class="esq-empresa">Rodada ${esc(i.rodada)}</small>` : ''}${p.tipo ? ` ${tipoEsq(p.tipo)}` : ''}${i.empresa ? ` <small class="esq-empresa">${esc(i.empresa)}</small>` : ''}</span>
                    ${etapas(i.etapa)}
                </header>
                <div class="esq-cadeia-corpo">
                    <div class="esq-coluna esq-col-pedido">
                        <button type="button" class="esq-no esq-no-pedido" onclick="painelAdicionarPedido('${esc(p.id)}')" title="Abrir o pedido">
                            <span class="esq-no-cabeca">
                                <span class="esq-no-tipo">Pedido</span>
                                ${tipoEsq(p.tipo || (i.rodada != null ? 'Natureza pela nota' : 'Tipo não informado'))}
                            </span>
                            <b>${esc(p.numero || 'Sem número')}</b>
                            <span class="esq-no-linha"><span>${esc(String(p.data).slice(0, 10))}</span><b>${dinheiro(p.valor || 0)}</b></span>
                            ${p.executor ? `<span class="esq-no-quem">${esc(p.executor)}</span>` : ''}
                        </button>
                    </div>
                    <div class="esq-seta" aria-hidden="true"></div>
                    <div class="esq-coluna esq-col-ramo${i.requisicoes.length > 1 ? ' varios' : ''}">
                        ${i.requisicoes.length ? i.requisicoes.map(noRequisicao).join('') : vazio('Sem requisição')}
                    </div>
                    <div class="esq-seta" aria-hidden="true"></div>
                    <div class="esq-coluna esq-col-ramo${i.notas.length > 1 ? ' varios' : ''}">
                        ${i.notas.length ? i.notas.map(noNota).join('') : vazio('Sem nota')}
                    </div>
                </div>
            </article>`
    }).join('')

    return `${barra}
        <div class="esq-hist-legenda"><span>Pedido</span><span>Requisições</span><span>Notas</span></div>
        <div class="esq-hist-lista">${cadeias}</div>`
}

// Câmera em tela cheia (js/campos_gcs.js): cada foto sobe e entra no cartão na hora; dá para tirar várias.
async function painelFotos(id, tabela) {
    abrirCameraGCS({
        titulo: 'Foto do cartão',
        aoCapturar: async src => {
            const resposta = await importarAnexos({ foto: src })
            if (!resposta?.[0]?.link) throw new Error(resposta?.mensagem || 'Falha no envio da foto')
            await enviar(`${tabela}/${id}/fotos/${crypto.randomUUID()}`, resposta[0])
        }
    })
}

async function excluirAnexo(id, tabela, idAnexo, coluna) {

    overlayAguarde()
    await deletar(`${tabela}/${id}/${coluna}/${idAnexo}`)
    removerOverlay()
}

async function confirmarExclusaoOrcamentoBase(id) {
    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirOrcamentoBase('${id}')` }
    ]
    popup({ mensagem: 'Deseja realmente excluir o orçamento?', botoes })
}

async function excluirOrcamentoBase(idOrcamento) {
    removerPopup()
    overlayAguarde()

    await deletar(`dados_orcamentos/${idOrcamento}`)

    removerPopup()
}

async function salvarAnexo(id, tabela, input) {

    overlayAguarde()

    if (input.files.length === 0) {
        popup({ elemento: 'Nenhum arquivo selecionado...' })
        return
    }

    // Retorna uma lista [{}, {}]
    const anexos = await importarAnexos({ input })

    if (anexos.resposta)
        return popup({ mensagem: anexos.mensagem })

    const anexosEmParalelo = anexos.map(async (anexo) => {
        const idAnexo = crypto.randomUUID()
        await enviar(`${tabela}/${id}/anexos/${idAnexo}`, anexo)
    })

    await Promise.all(anexosEmParalelo)

    removerOverlay()

}

async function apagarGenerico(id, tabela) {

    const botoes = [
        {
            texto: 'Confirmar',
            img: 'concluido',
            funcao: `confirmarApagarGenerico('${id}','${tabela}')`
        }
    ]

    popup({ botoes, mensagem: 'Excluir item?', titulo: 'Excluir Status' })
}


async function confirmarApagarGenerico(id, tabela) {

    try {
        removerPopup()
        // Sem overlay: o deletar() já bloqueia a linha com o loading.

        if (tabela == 'parceiros') {
            const pagamento = await recuperarDado('lista_pagamentos', id)
            const parceiro = await recuperarDado('parceiros', id)

            if (pagamento || Object.keys(parceiro?.solicitacoes || {}).length)
                return popup({ mensagem: 'Você não pode excluir essa LPU: Já existe um pagamento solicitado.' })

            // Deletar também o cartão da correção;
            const { ativo } = controles.ocorrencias
            const { master } = await recuperarDado('contratos_vinculados', ativo) || {}
            const departamento = master || ativo

            if (!departamento)
                return popup({ mensagem: 'Falha ao excluir o cartão: Fale com o suporte' })

            await deletar(`dados_ocorrencias/${departamento}/correcoes/${id}`)
        }

        await deletar(`${tabela}/${id}`)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao tentar excluir o status: Fale com o suporte.' })
    }

}

if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { shell: electronShell } = require('electron');
    shell = electronShell;
}

let ipcRenderer = null;
if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { ipcRenderer: ipc } = require('electron');
    ipcRenderer = ipc;

    ipcRenderer.on('open-save-dialog', (event, { htmlContent, nomeArquivo }) => {
        ipcRenderer.send('save-dialog', { htmlContent, nomeArquivo });
    });
}

async function irOS(idOrcamento) {
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('os.html', '_blank')
}

async function formDocAdicional(origem) {

    const linhas = [
        {
            texto: `Incluir ${origem}`,
            elemento: '<input type="file" id="docAdicional" multiple>'
        }
    ]

    const botoes = [
        { texto: 'Salvar', titulo: `Incluir doc ${origem}`, img: 'concluido', funcao: `salvarDocAdicional('${origem}')` }
    ]

    popup({ linhas, botoes })

}

async function salvarDocAdicional(origem) {

    overlayAguarde()

    try {

        const input = document.getElementById('docAdicional')
        const anexos = await importarAnexos({ input }) // Função de upload
        const departamento = controles.ocorrencias.ativo

        const promessasAnexos = anexos.map(anexo => {
            const id = crypto.randomUUID()
            return enviar(`anexos/${id}`, {
                id,
                origem,
                departamento,
                ...anexo
            })
        })

        await Promise.all(promessasAnexos)

        removerPopup()

    } catch (error) {
        popup({ mensagem: `Erro ao fazer upload: ${error.message}`, })
    }
}

function confirmarExclusaoDocAdicional(id) {

    const linhas = [
        { texto: 'Tem certeza?' }
    ]

    const botoes = [{
        texto: 'Confirmar',
        img: 'concluido',
        funcao: `excluirDocAdicional('${id}')`
    }]

    popup({ mensagem: 'Tem certeza?', botoes })
}

async function excluirDocAdicional(id) {

    removerPopup()
    await deletar(`anexos/${id}`)

}


async function enviarVinculo({ master, slave, desvincular = null }) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/vincular-contrato`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ master, slave, desvincular })
    })

    // Recusas de validação chegam com status 4xx e a mensagem para o usuário.
    const dados = await resposta.json().catch(() => ({}))

    if (!resposta.ok)
        return { success: false, mensagem: dados.mensagem || 'Falha ao vincular: Fale com o suporte.' }

    return dados
}
