let frotaCombustivel = []

function numeroCombustivel(valor) {
    const texto = String(valor ?? '').trim().replace(',', '.')
    if (!/^\d+(?:\.\d{1,3})?$/.test(texto)) throw new Error('Informe um número positivo, com até três casas decimais.')
    const numero = Number(texto)
    if (!Number.isFinite(numero)) throw new Error('Número inválido.')
    return numero
}

function formatarCombustivel(valor, casas = 2) {
    return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

async function consultarCombustivel(base, filtros = {}) {
    const itens = []
    let pagina = 1, paginas = 1
    do {
        const resposta = await pesquisarDB({ base, filtros, pagina, ordenar: { path: 'id', direcao: 'ASC' } })
        itens.push(...(resposta.resultados || []))
        paginas = Number(resposta.paginas) || 1
        pagina++
    } while (pagina <= paginas)
    return itens
}

async function telaCombustivel() {
    overlayAguarde()
    try {
        const [saldos, opcoes] = await Promise.all([
            consultarCombustivel('vw_combustivel_saldos'), consultarCombustivel('vw_veiculos_opcoes')
        ])
        const motoristas = new Map(opcoes.map(v => [String(v.id), v.motoristas_nomes]))
        frotaCombustivel = saldos.map(v => ({ ...v, motoristas_nomes: motoristas.get(String(v.id)) || '' }))
        const tabelaTanque = await modTab({ pag: 'tanquesCombustivel', body: 'bodyTanqueCombustivel', base: frotaCombustivel, criarLinha: 'criarLinhaTanqueCombustivel', colunas: {
            'Veículo': { chave: 'placa' },
            'Motoristas': { chave: 'motoristas_nomes' },
            'Combustível': { chave: 'combustivel' },
            'Tanque estimado': { chave: 'percentual' },
            'Consumo médio': { chave: 'consumo_medio' },
            'Consumido': { chave: 'litros_consumidos' },
            'Ações': {}
        } })
        tela.innerHTML = `<div class="pagina-conteudo">
            <div class="cabecalho-pagina"><h2>Combustível</h2></div>
            ${tabelaTanque}
        </div>`
        await paginacao('tanquesCombustivel')
    } catch (erro) {
        popup({ mensagem: escaparAtributo(erro.message || 'Falha ao carregar combustível. Execute o SQL de instalação primeiro.') })
    } finally { removerOverlay() }
}

function popupFormularioCombustivel({ titulo, elemento }) {
    const modelo = document.createElement('template')
    modelo.innerHTML = elemento.trim()
    const form = modelo.content.querySelector('form')
    const botaoSalvar = form.querySelector('[type="submit"]')
    const idForm = `form-combustivel-${crypto.randomUUID()}`
    const linhas = [...form.children].filter(filho => filho !== botaoSalvar).map(filho => {
        if (filho.hasAttribute('data-campo-motoristas')) return {
            texto: filho.querySelector('[data-titulo-motoristas]').outerHTML,
            elemento: filho.querySelector('[data-motoristas-combustivel]').outerHTML
        }
        if (filho.tagName !== 'LABEL') return { elemento: filho.outerHTML }
        const texto = filho.firstChild?.nodeType === 3 ? filho.firstChild.textContent.trim() : ''
        if (texto) filho.firstChild.remove()
        return { texto, elemento: filho.innerHTML, overlay: filho.hasAttribute('data-overlay') }
    })
    const idPopup = popup({
        titulo,
        linhas,
        botoes: [{ texto: botaoSalvar.textContent, img: 'concluido', funcao: `document.getElementById('${idForm}').requestSubmit()` }]
    })
    const painel = document.getElementById(idPopup).querySelector('.painel-padrao')
    form.replaceChildren()
    form.id = idForm
    form.className = 'combustivel-modal-form'
    painel.replaceWith(form)
    form.appendChild(painel)
    // Mantém o controle de envio duplicado e o envio por Enter no formulário.
    botaoSalvar.hidden = true
    form.appendChild(botaoSalvar)
    return idPopup
}

function linhaMotoristaCombustivel(motorista = {}) {
    const nomeCampo = `comb-motorista-${crypto.randomUUID()}`
    controlesCxOpcoes[nomeCampo] = {
        base: 'clientes', retornar: ['nome'],
        filtros: { usuario: { op: 'NOT_EMPTY' } },
        colunas: { 'Nome': { chave: 'nome' }, 'Usuário': { chave: 'usuario' }, 'Cidade': { chave: 'cidade' } }
    }
    return `<div class="combustivel-motorista" data-motorista-combustivel>
        <button type="button" class="combustivel-controle-motorista" title="Remover motorista" aria-label="Remover motorista" onclick="removerMotoristaCombustivel(this)"><img src="imagens/cancel.png" alt=""></button>
        <span class="opcoes" name="${nomeCampo}" ${motorista.id != null ? `id="${escaparAtributo(motorista.id)}"` : ''}
            onclick="cxOpcoes('${nomeCampo}')">${escaparAtributo(motorista.nome || 'Selecionar motorista')}</span>
    </div>`
}

function adicionarMotoristaCombustivel(botao) {
    botao.closest('form').querySelector('[data-motoristas-combustivel]').insertAdjacentHTML('beforeend', linhaMotoristaCombustivel())
}

function removerMotoristaCombustivel(botao) {
    const linha = botao.closest('[data-motorista-combustivel]')
    delete controlesCxOpcoes[linha.querySelector('span').getAttribute('name')]
    linha.remove()
}

function lerMotoristasCombustivel(form) {
    const ids = new Set()
    for (const campo of form.querySelectorAll('[data-motorista-combustivel] span')) {
        if (!campo.id) throw new Error('Selecione o motorista ou remova a linha em branco.')
        ids.add(campo.id)
    }
    return [...ids].map(id => ({ id: /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : id }))
}

async function formularioVeiculoCombustivel(id) {
    try {
        const v = id ? await recuperarDado('veiculos', id) : {}
        if (id && !v) throw new Error('Veículo não encontrado.')
        const idsMotoristas = [...new Set((v.motoristas || []).map(m => String(m.id)).filter(id => id !== 'undefined'))]
        const motoristas = await Promise.all(idsMotoristas.map(async id => {
            const cliente = await recuperarDado('clientes', id)
            return linhaMotoristaCombustivel({ id, nome: cliente?.nome || `Motorista ${id}` })
        }))
        const campo = (nome, texto, valor = '', tipo = 'text') => `<label>${texto}<input name="${nome}" type="${tipo}" value="${escaparAtributo(valor ?? '')}"></label>`
        popupFormularioCombustivel({ titulo: id ? 'Editar veículo' : 'Cadastrar veículo', elemento: `
            <form class="combustivel-form" data-id="${escaparAtributo(id || crypto.randomUUID())}" onsubmit="event.preventDefault(); salvarVeiculoCombustivel(this)">
                ${campo('placa', 'Placa', v.placa)}${campo('modelo', 'Marca e modelo', v.modelo)}
                ${campo('ano', 'Ano', v.ano, 'number')}
                <div data-campo-motoristas>
                    <div class="combustivel-titulo-motoristas" data-titulo-motoristas>
                        <button type="button" class="combustivel-controle-motorista" title="Adicionar motorista" aria-label="Adicionar motorista" onclick="adicionarMotoristaCombustivel(this)"><img src="imagens/baixar.png" alt=""></button>
                        <span>Motoristas vinculados</span>
                    </div>
                    <div data-motoristas-combustivel>${motoristas.join('')}</div>
                </div>
                <label>Combustível<select name="combustivel">${['Gasolina', 'Etanol', 'Diesel', 'Flex'].map(op => `<option ${v.combustivel === op ? 'selected' : ''}>${op}</option>`).join('')}</select></label>
                ${campo('capacidade_tanque', 'Capacidade do tanque (L)', v.capacidade_tanque)}
                ${campo('consumo_medio', 'Consumo médio (km/l)', v.consumo_medio)}
                ${campo('saldo_inicial', 'Litros existentes ao iniciar o controle', v.saldo_inicial || 0)}
                <small>O saldo inicial só pode ser alterado antes das movimentações. Mudanças de km/l valem para novos consumos.</small>
                <label><input name="ativo" type="checkbox" ${v.ativo !== false ? 'checked' : ''}> Veículo ativo</label>
                <p role="status"></p><button type="submit">Salvar veículo</button>
            </form>` })
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

async function executarFormularioCombustivel(form, tarefa) {
    const botao = form.querySelector('[type="submit"]')
    if (botao.disabled) return
    botao.disabled = true
    try {
        await tarefa()
        removerPopup(form.closest('.popup').id)
        await telaCombustivel()
    } catch (erro) { form.querySelector('[role="status"]').textContent = erro.message }
    finally { botao.disabled = false }
}

async function salvarVeiculoCombustivel(form) {
    return executarFormularioCombustivel(form, async () => {
        const valor = nome => form.elements.namedItem(nome).value.trim()
        const capacidade_tanque = numeroCombustivel(valor('capacidade_tanque'))
        const consumo_medio = numeroCombustivel(valor('consumo_medio'))
        const saldo_inicial = numeroCombustivel(valor('saldo_inicial'))
        if (!valor('placa') || !valor('modelo')) throw new Error('Informe placa e modelo.')
        if (capacidade_tanque <= 0 || consumo_medio <= 0 || saldo_inicial > capacidade_tanque)
            throw new Error('Informe tanque e km/l positivos e saldo inicial até a capacidade do tanque.')
        const anterior = await recuperarDado('veiculos', form.dataset.id) || {}
        const motoristas = lerMotoristasCombustivel(form)
        const resposta = await enviar(`veiculos/${form.dataset.id}`, { ...anterior, id: form.dataset.id,
            placa: valor('placa').toUpperCase().replace(/[^A-Z0-9]/g, ''), modelo: valor('modelo'),
            ano: valor('ano') ? Number(valor('ano')) : null, combustivel: valor('combustivel'),
            capacidade_tanque, consumo_medio, saldo_inicial, motoristas, ativo: form.elements.ativo.checked })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar o veículo.')
    })
}

function formularioAbastecimento(veiculoId) {
    for (const [nome, base, rotulo] of [
        ['comb_fornecedor', 'clientes', 'nome'], ['comb_categoria', 'mesc_categorias', 'id'], ['comb_transitorio', 'mesc_departamentos', 'id']
    ]) controlesCxOpcoes[nome] = { base, retornar: [rotulo], colunas: { 'Cadastro': { chave: rotulo } } }
    const opcao = (nome, texto, id, descricao = id) => `<label data-overlay>${texto}<span name="${nome}" id="${escaparAtributo(id)}" class="opcoes" onclick="cxOpcoes('${nome}')">${escaparAtributo(descricao)}</span></label>`
    popupFormularioCombustivel({ titulo: 'Registrar abastecimento', elemento: `
        <form class="combustivel-form" data-veiculo="${escaparAtributo(veiculoId)}" data-id="${crypto.randomUUID()}" data-pagamento="${crypto.randomUUID()}"
            onsubmit="event.preventDefault(); salvarAbastecimento(this)">
            <label>Data do abastecimento<input name="data_abastecimento" type="date" required value="${dataServidor().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}"></label>
            <label>Litros abastecidos<input name="litros" inputmode="decimal" placeholder="Ex.: 20,5" required></label>
            <label>Valor total (R$)<input name="valor_total" inputmode="decimal" required></label>
            <label>Observação<textarea name="observacao"></textarea></label>
            <label>Empresa do pagamento<select name="app">${empresas.filter(a => ['AC', 'IAC', 'HNK'].includes(a)).map(a => `<option>${escaparAtributo(a)}</option>`).join('')}</select></label>
            ${opcao('comb_fornecedor', 'Fornecedor', '6066446384', 'TICKET LOG')}${opcao('comb_categoria', 'Categoria do pagamento', 'Combustível')}
            ${opcao('comb_transitorio', 'Centro de custo transitório', 'COMBUSTÍVEL NÃO ALOCADO')}
            <p role="status"></p><button type="submit">Salvar abastecimento</button>
        </form>` })
}

async function salvarAbastecimento(form) {
    return executarFormularioCombustivel(form, async () => {
        const valor = nome => form.elements.namedItem(nome).value.trim()
        const litros = numeroCombustivel(valor('litros')), valor_total = numeroCombustivel(valor('valor_total'))
        if (litros <= 0 || valor_total <= 0 || Math.abs(valor_total * 100 - Math.round(valor_total * 100)) > 1e-7)
            throw new Error('Informe litros positivos e valor com até duas casas decimais.')
        const referencia = nome => form.querySelector(`[name="${nome}"]`).id
        const fornecedor = referencia('comb_fornecedor'), categoria = referencia('comb_categoria'), transitorio = referencia('comb_transitorio')
        if (!fornecedor || !categoria || !transitorio) throw new Error('Selecione fornecedor, categoria e centro de custo transitório.')
        const resposta = await enviar(`combustivel_abastecimentos/${form.dataset.id}`, {
            id: form.dataset.id, veiculo_id: form.dataset.veiculo, data_abastecimento: valor('data_abastecimento'),
            litros, valor_total, observacao: valor('observacao'),
            pagamento_id: form.dataset.pagamento, usuario: acesso.usuario,
            pagamento_config: { fornecedor, categoria, transitorio, app: valor('app') }
        })
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar o abastecimento.')
    })
}

async function detalhesCombustivel(id) {
    overlayAguarde()
    try {
        const filtro = { veiculo_id: { op: '=', value: id } }
        const [abastecimentos, consumos, rateios] = await Promise.all([
            consultarCombustivel('combustivel_abastecimentos', { ...filtro, excluido: { op: 'IS_EMPTY' } }),
            consultarCombustivel('combustivel_consumos', filtro), consultarCombustivel('vw_combustivel_rateios', filtro)
        ])
        const e = escaparAtributo, n = formatarCombustivel
        const veiculo = frotaCombustivel.find(v => String(v.id) === id)
        const totalConsumido = consumos.reduce((soma, c) => soma + Number(c.litros), 0)
        const semOrigem = Math.max(0, totalConsumido - Math.min(totalConsumido, Number(veiculo?.saldo_inicial || 0))
            - rateios.reduce((soma, r) => soma + Number(r.litros_distribuidos), 0))
        const tabelaAbastecimento = await modTab({ pag: 'abastecimentosCombustivel', body: 'bodyAbastecimentoCombustivel', base: abastecimentos.map(a => ({ ...a, rateio: rateios.find(r => r.id === a.id) })), criarLinha: 'criarLinhaAbastecimentoCombustivel', scroll: false, colunas: {
            'Data': { chave: 'data_abastecimento' , tipoPesquisa: 'data' },
            'Litros': { chave: 'litros' },
            'Valor total': { chave: 'valor_total' },
            'Motorista / Observação': { chave: 'motorista' },
            'Sem departamento': { chave: 'rateio.litros_pendentes' },
            'Rateio por departamento': {},
            'Pagamento': {}
        } })
        const tabelaConsumo = await modTab({ pag: 'consumosCombustivel', body: 'bodyConsumoCombustivel', base: consumos, criarLinha: 'criarLinhaConsumoCombustivel', scroll: false, colunas: {
            'Data': { chave: 'data_consumo' , tipoPesquisa: 'data' },
            'Distância': { chave: 'km' },
            'Litros': { chave: 'litros' },
            'Departamento': { chave: 'departamento' },
            'Motorista': { chave: 'motorista' },
            'Consumo médio': { chave: 'consumo_medio' },
            'Ocorrência / Correção': { chave: 'ocorrencia_id' }
        } })
        popup({ titulo: 'Movimentos de combustível', elemento: `<div class="combustivel-movimentos">
            ${semOrigem > 0.001 ? `<p class="combustivel-alerta">${n(semOrigem)} L consumidos sem abastecimento anterior compatível. Confira datas e saldo inicial antes de distribuir custos.</p>` : ''}
            <h3>Abastecimentos</h3>
            ${tabelaAbastecimento}
            <h3>Consumos nas correções</h3>
            ${tabelaConsumo}
            <p>O rateio exibido é uma prévia FIFO. A redistribuição automática no Omie ainda não é executada.</p>
        </div>` })
        await paginacao('abastecimentosCombustivel')
        await paginacao('consumosCombustivel')
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
    finally { removerOverlay() }
}

async function prepararPagamentoAbastecimento(id) {
    try {
        const a = await recuperarDado('combustivel_abastecimentos', id)
        if (!a) throw new Error('Abastecimento não encontrado.')
        const existente = await recuperarDado('lista_pagamentos', a.pagamento_id)
        if (existente?.id) return abrirDetalhesPagamentos(a.pagamento_id)
        const rascunho = JSON.parse(localStorage.getItem('ultimoPagamento') || '{}')
        if (Object.keys(rascunho).length && rascunho.id !== a.pagamento_id)
            throw new Error('Salve ou descarte o rascunho atual de pagamento antes de preparar este abastecimento.')
        if (document.getElementById('totalPagamento')) throw new Error('Feche o formulário de pagamento aberto antes de continuar.')
        const config = a.pagamento_config || {}
        const valor = Number(a.valor_total)
        localStorage.setItem('ultimoPagamento', JSON.stringify({ id: a.pagamento_id, app: config.app,
            param_estavel: { codigo_cliente_fornecedor: config.fornecedor,
                observacao: `Abastecimento ${a.id}: ${formatarCombustivel(a.litros)} L. ${a.observacao || ''}`,
                valor_documento: valor, categorias: [{ codigo_categoria: config.categoria, valor }],
                distribuicao: [{ cCodDep: config.transitorio, nValDep: valor }] }
        }))
        await formularioPagamento()
    } catch (erro) { popup({ mensagem: escaparAtributo(erro.message) }) }
}

async function camposCombustivelCorrecao(correcao) {
    const atual = correcao.combustivel || {}
    controlesCxOpcoes.comb_veiculo = {
        base: 'vw_veiculos_opcoes',
        filtros: {
            ativo: { op: '=', value: true },
            consumo_medio: { op: '>', value: 0 },
            capacidade_tanque: { op: '>', value: 0 }
        },
        retornar: ['placa', 'modelo', 'motoristas_nomes'],
        colunas: {
            'Placa': { chave: 'placa' },
            'Modelo': { chave: 'modelo' },
            'Motoristas': { chave: 'motoristas_nomes' },
            'km/l': { chave: 'consumo_medio' }
        }
    }
    const selecionado = atual.veiculo_id ? await recuperarDado('vw_veiculos_opcoes', atual.veiculo_id) : null
    const descricaoVeiculo = selecionado
        ? [selecionado.placa, selecionado.modelo, selecionado.motoristas_nomes].filter(Boolean).join(' · ')
        : atual.veiculo_id || 'Selecionar veículo'
    return `<div class="combustivel-form" data-combustivel-correcao>
        <label>Veículo utilizado<span name="comb_veiculo" class="opcoes" ${atual.veiculo_id ? `id="${escaparAtributo(atual.veiculo_id)}"` : ''}
            onclick="cxOpcoes('comb_veiculo')">${escaparAtributo(descricaoVeiculo)}</span></label>
        <button type="button" onclick="const bloco = this.closest('[data-combustivel-correcao]'); const veiculo = bloco.querySelector('[name=comb_veiculo]'); veiculo.removeAttribute('id'); veiculo.textContent = 'Selecionar veículo'; bloco.querySelector('[name=comb_km]').value = ''">Sem deslocamento</button>
        <label>Quilômetros percorridos no total da correção<input name="comb_km" inputmode="decimal" value="${escaparAtributo(atual.km || '')}" placeholder="Ex.: 65,5"></label>
        <label>Motorista<input name="comb_motorista" value="${escaparAtributo(atual.motorista || '')}"></label>
        <small>Preencha somente o percurso realizado. O consumo é estimado pelo km/l do veículo.</small>
    </div>`
}

function lerCombustivelCorrecao(idChamado) {
    const areaTecnicos = document.querySelector('.tecnicos[data-combustivel-correcao]')
    if (areaTecnicos) {
        if (!idChamado) throw new Error('Chamado do percurso não identificado.')
        if (areaTecnicos.dataset.combustivelCarregando === 'true') throw new Error('Aguarde a consulta dos veículos dos técnicos.')
        if (areaTecnicos.dataset.combustivelErro) throw new Error(areaTecnicos.dataset.combustivelErro)
        const percursos = []
        for (const bloco of areaTecnicos.querySelectorAll('[data-percurso-tecnico]')) {
            const texto = bloco.querySelector('[name="km_tecnico"]').value.trim()
            if (!texto) continue
            const km = numeroCombustivel(texto)
            if (km <= 0) throw new Error('Informe quilômetros positivos ou deixe o campo vazio para não consumir.')
            const veiculo_id = bloco.querySelector('[name="veiculo_tecnico"]').value
            if (!veiculo_id) throw new Error(`Selecione o veículo de ${bloco.dataset.percursoTecnico}.`)
            if (percursos.some(p => p.tecnico === bloco.dataset.percursoTecnico)) throw new Error('O técnico está repetido. Registre seu percurso em uma única linha.')
            percursos.push({ tecnico: bloco.dataset.percursoTecnico, motorista: bloco.dataset.percursoTecnico,
                veiculo_id, km, departamento: String(idChamado) })
        }
        return { versao: 2, percursos }
    }
    const bloco = document.querySelector('[data-combustivel-correcao]')
    if (!bloco) return undefined
    const veiculo_id = bloco.querySelector('[name="comb_veiculo"]').id
    const kmTexto = bloco.querySelector('[name="comb_km"]').value.trim()
    if (!veiculo_id && !kmTexto) return null
    if (!veiculo_id) throw new Error('Selecione o veículo do percurso.')
    const km = numeroCombustivel(kmTexto)
    if (km <= 0) throw new Error('Informe os quilômetros percorridos.')
    const departamento = String(idChamado || '')
    if (!departamento) throw new Error('Chamado do percurso não identificado.')
    return { veiculo_id, km, departamento, motorista: bloco.querySelector('[name="comb_motorista"]').value.trim() }
}

async function atualizarKmTecnicosCorrecao() {
    const area = document.querySelector('.tecnicos[data-combustivel-correcao]')
    if (!area) return
    const versao = (area.combustivelConsulta || 0) + 1
    area.combustivelConsulta = versao
    const campos = [...area.querySelectorAll('[data-usuario-selecao]')].filter(c => c.id)
    if (!campos.length) {
        area.dataset.combustivelCarregando = 'false'
        delete area.dataset.combustivelErro
        return
    }
    area.dataset.combustivelCarregando = 'true'
    try {
        area.combustivelVeiculos ??= Promise.all([
            consultarCombustivel('vw_veiculos_opcoes'), consultarCombustivel('veiculos')
        ]).then(([opcoes, cadastros]) => {
            const porId = new Map(cadastros.map(v => [String(v.id), v]))
            return opcoes.map(v => ({ ...porId.get(String(v.id)), ...v,
                motoristas: porId.get(String(v.id))?.motoristas || [] }))
        })
        const veiculos = await area.combustivelVeiculos
        if (!area.isConnected || versao !== area.combustivelConsulta) return
        delete area.dataset.combustivelErro
        const original = area.combustivelOriginal || {}
        for (const campo of campos) {
            const tecnico = campo.textContent.trim()
            const linha = campo.closest('[data-linha-usuario]')
            const anterior = linha.querySelector('[data-percurso-tecnico]')
            if (anterior?.dataset.percursoTecnico === tecnico) continue
            anterior?.remove()
            const salvo = Array.isArray(original.percursos) ? original.percursos.find(p => p.tecnico === tecnico)
                : original.veiculo_id && campo === campos[0] ? original : null
            const normalizar = valor => String(valor ?? '').trim().toLocaleLowerCase('pt-BR')
            const carros = veiculos.filter(v => (v.ativo && Number(v.consumo_medio) > 0 && (
                (v.motoristas_ids || []).map(String).includes(String(campo.id)) ||
                (v.motoristas || []).some(m => String(m?.id ?? m) === String(campo.id)) ||
                (v.motoristas_usuarios || []).some(usuario => normalizar(usuario) === normalizar(tecnico)))) ||
                (salvo && String(v.id) === String(salvo.veiculo_id)))
            if (!carros.length) continue
            const selecionado = salvo?.veiculo_id || (carros.length === 1 ? String(carros[0].id) : '')
            linha.insertAdjacentHTML('beforeend', `<div class="combustivel-percurso-tecnico" data-percurso-tecnico="${escaparAtributo(tecnico)}">
                <label>Veículo<select name="veiculo_tecnico">${carros.length > 1 ? '<option value="">Selecionar veículo</option>' : ''}
                    ${carros.map(v => `<option value="${escaparAtributo(v.id)}" ${String(v.id) === selecionado ? 'selected' : ''}>${escaparAtributo(v.placa || '')} · ${escaparAtributo(v.modelo || '')}</option>`).join('')}</select></label>
                <label>Quilômetros percorridos<input name="km_tecnico" inputmode="decimal" placeholder="Ex.: 65,5" value="${escaparAtributo(salvo?.km ?? '')}"></label>
            </div>`)
        }
    } catch (erro) {
        if (!area.isConnected || versao !== area.combustivelConsulta) return
        area.combustivelVeiculos = null
        area.dataset.combustivelErro = 'Não foi possível consultar os veículos dos técnicos. Selecione o técnico novamente para tentar de novo.'
        popup({ mensagem: escaparAtributo(area.dataset.combustivelErro) })
    } finally {
        if (versao === area.combustivelConsulta) area.dataset.combustivelCarregando = 'false'
    }
}

function botaoAcaoCombustivel(acao, id) {
    const acoes = {
        editar: { titulo: 'Editar veículo', funcao: 'formularioVeiculoCombustivel', desenho: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>' },
        movimentos: { titulo: 'Ver movimentos', funcao: 'detalhesCombustivel', desenho: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>' },
        abastecer: { titulo: 'Registrar abastecimento', funcao: 'formularioAbastecimento', desenho: '<path d="M3 21h12M5 21V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v17M5 10h8m0 3h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9l-4-4"/><path d="M18 6v4h3"/>' },
        prepararPagamento: { titulo: 'Preparar pagamento', funcao: 'prepararPagamentoAbastecimento', desenho: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-5 3v4m-2-2h4M6 15h3"/>' },
        abrirPagamento: { titulo: 'Abrir pagamento', funcao: 'prepararPagamentoAbastecimento', desenho: '<path d="M14 3h7v7m0-7-9 9"/><path d="M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>' }
    }
    const item = acoes[acao]
    return `<button type="button" class="combustivel-botao-icone" data-id="${escaparAtributo(id)}" title="${item.titulo}" aria-label="${item.titulo}" onclick="${item.funcao}(this.dataset.id)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${item.desenho}</svg></button>`
}

function criarLinhaTanqueCombustivel(v) {
    const e = escaparAtributo
    const configurado = Number(v.capacidade_tanque) > 0 && Number(v.consumo_medio) > 0
    const percentual = Number(v.percentual) || 0
    const alerta = Number(v.saldo_litros) < 0 ? 'Saldo negativo: revise abastecimentos e percursos.'
        : Number(v.saldo_litros) > Number(v.capacidade_tanque) && configurado ? 'Saldo acima do tanque: revise os movimentos.' : ''
    return `<tr>
        <td><div class="combustivel-veiculo">
            <strong>${e(v.placa || 'Sem placa')}</strong>
            <span>${e(v.modelo || 'Veículo')}</span>
            <small>${v.ativo ? 'Ativo' : 'Inativo'}</small>
        </div></td>
        <td>${e(v.motoristas_nomes || 'Nenhum vinculado')}</td>
        <td>${e(v.combustivel || 'Não informado')}</td>
        <td><div class="combustivel-nivel" style="--cor-nivel: ${percentual <= 15 ? '#b83b32' : percentual <= 30 ? '#a36b13' : '#38794c'};">${configurado ? `<strong>${formatarCombustivel(percentual, 1)}%</strong>
            <span class="combustivel-trilho"><meter class="combustivel-barra" min="0" max="100" value="${Math.min(100, Math.max(0, percentual))}" aria-label="Percentual estimado do tanque de ${e(v.placa || v.modelo || 'veículo')}"></meter></span>
            <small>${formatarCombustivel(v.saldo_litros)} L de ${formatarCombustivel(v.capacidade_tanque)} L</small>`
            : '<span>Configure a capacidade e o consumo médio.</span>'}
            ${alerta ? `<small class="combustivel-alerta">${alerta}</small>` : ''}</div></td>
        <td>${configurado ? `${formatarCombustivel(v.consumo_medio)} km/l` : '—'}</td>
        <td>${formatarCombustivel(v.litros_consumidos)} L</td>
        <td><div class="combustivel-acoes-icones">
            ${botaoAcaoCombustivel('editar', v.id)}
            ${botaoAcaoCombustivel('movimentos', v.id)}
            ${configurado && v.ativo ? botaoAcaoCombustivel('abastecer', v.id) : ''}
        </div></td>
    </tr>`

}

function criarLinhaAbastecimentoCombustivel(a) {
    const e = escaparAtributo, n = formatarCombustivel
    const r = a.rateio
    return `<tr><td>${e(a.data_abastecimento)}</td><td>${n(a.litros)} L</td><td>R$ ${n(a.valor_total)}</td>
        <td>${e(a.motorista || '—')}<small>${e(a.observacao || '')}</small></td>
        <td>${n(r?.litros_pendentes)} L</td>
        <td>${(r?.departamentos || []).map(d => `<span>${e(d.departamento)}: ${n(d.litros)} L · R$ ${n(d.custo)}</span>`).join('') || '—'}</td>
        <td>${botaoAcaoCombustivel(r?.pagamento_criado ? 'abrirPagamento' : 'prepararPagamento', a.id)}</td>
    </tr>`

}

function criarLinhaConsumoCombustivel(c) {
    const e = escaparAtributo, n = formatarCombustivel
    return `<tr><td>${e(c.data_consumo)}</td><td>${n(c.km)} km</td><td>${n(c.litros)} L</td>
                    <td>${e(c.departamento)}</td><td>${e(c.motorista || '—')}</td><td>${n(c.consumo_medio)} km/l</td>
                    <td>${e(c.ocorrencia_id)}<small>Correção: ${e(c.correcao_id)}</small></td></tr>`
}
