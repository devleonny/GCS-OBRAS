let painelCentral = document.querySelector('.painelCentral')
let filtrosOcorrencias = {}
let anexosProvisorios = {}

const btn = (imagem, termo, link) => `
    <div class="btnLateral" onclick="${link ? link : `opcoesPainel('${termo}')`}">
        <img src="imagens/${imagem}.png" style="width: 1.5vw;">
        <label>${termo}</label>
    </div>
`

const menus = {
    'Dashboard': {
        imagem: 'relatorio',
        paineis: [{
            nome: 'Não disponível',
            funcao: ''
        }]
    },
    'Ocorrências': {
        imagem: 'megafone',
        paineis: [{
            nome: 'Painel',
            funcao: 'carregarOcorrencias()'
        },
        {
            nome: 'Lista de Ocorrências',
            funcao: ''
        },
        {
            nome: 'Ocorrências ',
            funcao: ''
        }]
    },
    'Relatórios': {
        imagem: 'prancheta',
        paineis: [{
            nome: 'Não disponível',
            funcao: ''
        }]
    },
    'Cadastros': {
        imagem: 'gerente',
        paineis: [{
            nome: 'Unidades de Manutenção',
            funcao: `painelCadastro('dados_clientes')`
        },
        {
            nome: 'Equipamentos',
            funcao: `painelCadastro('dados_composicoes')`
        },
        {
            nome: 'Sistemas',
            funcao: `carregarTabelasAuxiliares('sistemas')`
        },
        {
            nome: 'Prioridades de Correção',
            funcao: `carregarTabelasAuxiliares('prioridades')`
        },
        {
            nome: 'Status de Correção',
            funcao: `carregarTabelasAuxiliares('correcoes')`
        },
        {
            nome: 'Tipos',
            funcao: `carregarTabelasAuxiliares('tipos')`
        }
        ]

    },
    'Configurações': {
        imagem: 'ajustar',
        paineis: [{
            nome: 'Não disponível',
            funcao: ''
        }]
    },
}

const esquemaCampos = {
    correcoes: ['nome'],
    dados_clientes: ['nome', 'cnpj', 'cidade'],
    dados_composicoes: ['descricao', 'modelo', 'tipo'],
    sistemas: ['nome'],
    prioridades: ['nome'],
    tipos: ['nome'],
    dados_setores: ['usuario']
}

botoesLaterais()
carregarOcorrencias()
//painelCadastro('dados_composicoes')

async function atualizarOcorrencias() {

    await sincronizarDados('dados_ocorrencias')
    await carregarOcorrencias()

}

function botoesLaterais() {

    let painelLateral = document.querySelector('.painelLateral')

    painelLateral.insertAdjacentHTML('beforeend', btn('LG', 'Início', `window.location.href='inicial.html'`))

    for (const [termo, dados] of Object.entries(menus)) {
        painelLateral.insertAdjacentHTML('beforeend', btn(dados.imagem, termo))
    }

}

function opcoesPainel(termo) {

    const opcoes = menus[termo].paineis
        .map(op => `<label onclick="${op.funcao}">${op.nome}</label>`).join('')

    let acumulado = `
    <div class="painelCascata">
        <span class="close" style="font-size: 2vw; position: absolute; top: 5px; right: 15px;" onclick="removerMenus()">×</span>
        ${opcoes}
    </div>
    `
    let painelCascata = document.querySelector('.painelCascata')
    if (painelCascata) painelCascata.remove()

    let painelLateral = document.querySelector('.painelLateral')
    painelLateral.insertAdjacentHTML('afterend', acumulado)

}

function removerMenus() {
    let painelCascata = document.querySelector('.painelCascata')
    if (painelCascata) painelCascata.remove()
}

async function painelCadastro(nomeBaseReferencia) {

    removerMenus()

    const dadosReferencia = await recuperarDados(nomeBaseReferencia)

    const tabelas = tabelasHTML()

    const acumulado = `
        <div style="${horizontal}; width: 85vw;">
            ${tabelas.referencia}

            <div style="border-right: 1px dashed #d2d2d2; margin: 1vw; height: 80vh;"></div>

            ${tabelas.ativos}
        </div>

    `
    painelCentral.innerHTML = acumulado

    // Função que carrega os elementos
    function tabelasHTML() {

        let tabelas = {}
        let linhas = {
            referencia: {
                string: '',
                quantidade: 0
            },
            ativos: {
                string: '',
                quantidade: 0
            },
        }

        Object.entries(dadosReferencia).forEach(([cod, recorte]) => {

            const labels = esquemaCampos[nomeBaseReferencia]
                .map(campo => modelo(String(campo).toUpperCase(), recorte?.[campo] || '??'))
                .join('')

            linhas.referencia.quantidade++
            linhas.referencia.string += `
                <div name="psq_referencia" class="divsListagem">
                    <input name="referencia" id="${cod}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                    <div style="${vertical};">

                        ${labels}

                    </div>
                </div>`

            if (recorte.ocorrencia) {
                linhas.ativos.quantidade++
                linhas.ativos.string += `
                <div name="psq_ativos" class="divsListagem">
                    <input name="ativos" id="${cod}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                    <div style="${vertical};">

                        ${labels}

                    </div>
                </div>`}
        })

        for (const [tabela, conteudo] of Object.entries(linhas)) {

            tabelas[tabela] = `
                <div style="width: 50%;">
                    <label style="font-size: 2.0vw; color: white;">${tabela} - ${conteudo.quantidade}</label>
                    <div class="painelBotoes" style="justify-content: start; align-items: center; gap: 1vw;">
                        <div style="${horizontal}; gap: 5px;">
                            <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this, '${tabela}')">
                            <label>Todos</label>
                        </div>
                        <div style="${horizontal}; background-color: white; border-radius: 5px; padding-left: 1vw; padding-right: 1vw;">
                            <input oninput="pesquisar(this, '${tabela}')" placeholder="Pesquisar" style="width: 100%;">
                            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                        </div>
                        ${botao('Mover', `gerenciar('${tabela}', '${nomeBaseReferencia}')`)}
                    </div>

                    <div style="width: 100%; height: max-content; max-height: 65vh; overflow-y: auto; overflow-x: hidden;">
                        ${conteudo.string}
                    </div>
                    <div class="rodapeTabela"></div>
                </div>
           `

        }

        return tabelas
    }

}

async function gerenciar(tabela, nomeBaseReferencia) {

    overlayAguarde()

    let dadosReferencia = await recuperarDados(nomeBaseReferencia)
    let inputs = document.querySelectorAll(`[name="${tabela}"]`)
    let alteracoes = {}

    for (let inputTab of inputs) {

        if (inputTab.checked) {

            const id = inputTab.id
            const ativo = tabela == 'referencia'

            alteracoes[id] = ativo
            dadosReferencia[id].ocorrencia = ativo

        }

    }

    await ativarChaveOcorrencias(nomeBaseReferencia, alteracoes)

    await inserirDados(dadosReferencia, nomeBaseReferencia)

    await painelCadastro(nomeBaseReferencia)

    removerOverlay()

}

function marcarTodosVisiveis(input, tituloAtual) {

    let inputs = document.querySelectorAll(`[name='${tituloAtual}']`)

    inputs.forEach((inputTab, i) => {

        const div = inputTab.parentElement
        const marcar = div.style.display !== 'none'
        if (marcar) inputTab.checked = input.checked

    })

}

async function carregarTabelasAuxiliares(nomeBaseAuxiliar) {

    removerMenus()
    await sincronizarDados(nomeBaseAuxiliar)

    const baseAuxiliar = await recuperarDados(nomeBaseAuxiliar)

    const linhas = Object.entries(baseAuxiliar)
        .map(([cod, recorte]) => `
        <tr>
            <td>${recorte.nome}</td>
            <td>
                <div style="${horizontal};">
                    <img onclick="editar('${nomeBaseAuxiliar}', '${cod}')" src="imagens/pesquisar2.png" style="cursor: pointer; width: 1.5vw;">
                </div>
            </td>
        </tr>
        `).join('')

    let acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes">
                ${botao('Novo', `editar('${nomeBaseAuxiliar}')`)}
            </div>
            <div style="height: max-content; max-height: 60vh; overflow-y: auto;">
                <table class="tabela">
                    <thead>
                        <th>Nome</th>
                        <th>Ações</th>
                    </thead>

                    <tbody>
                        ${linhas}
                    </tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    painelCentral.innerHTML = acumulado
}

async function editar(tabela, cod) {

    let dado = {}

    if (cod) {
        dado = await recuperarDado(cod, tabela)
    } else {
        cod = ID5digitos()
    }

    const acumulado = `
        <div style="padding: 2vw; background-color: #d2d2d2;">
            <div style="${horizontal}; gap: 5px;">
                <textarea id="campo" style="padding: 5px; border-radius: 2px;">${dado?.nome || ''}</textarea>
                ${botao('Salvar', `salvar('${tabela}', '${cod}')`, 'green')}
            </div>
            <hr style="width: 100%;">
            ${acesso.permissao == 'adm' ? botao('Excluir', `excluir('${cod}', '${tabela}')`) : ''}
        </div>
    `

    popup(acumulado, inicialMaiuscula(tabela), true)

}

async function salvar(tabela, cod) {

    overlayAguarde()
    let dado = await recuperarDado(tabela, cod) || {}
    const novoNome = document.getElementById('campo')

    if (novoNome) {
        dado.nome = novoNome.value
        await inserirDados({ [cod]: dado }, tabela)
        await enviar(`${tabela}/${cod}`, dado)
    }

    await carregarTabelasAuxiliares(tabela)
    removerPopup()
}

async function excluir(cod, tabela) {

    removerPopup()
    overlayAguarde()

    await deletarDB(tabela, cod)
    await deletar(`${tabela}/${cod}`)

    await carregarTabelasAuxiliares(tabela)
    removerOverlay()

}

function dtAuxOcorrencia(dt) {

    if (!dt) return '--'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

function ir(img, acao, idOcorrencia) {
    const divMaior = img.closest('div')?.parentElement
    const tabelas = divMaior?.querySelectorAll('table') || []
    const paginaAtual = img.closest('div').querySelectorAll('label')[0]

    if (!paginaAtual) return

    const numeroAtual = Number(paginaAtual.textContent)
    const proximoNumero = acao === 'avancar' ? numeroAtual + 1 : numeroAtual - 1
    const novaPagina = document.querySelectorAll(`[name=${idOcorrencia}_${proximoNumero}]`)

    if (novaPagina.length == 0) return

    for (const tabela of tabelas) tabela.style.display = 'none'
    novaPagina.forEach(pag => pag.style.display = '')
    paginaAtual.textContent = proximoNumero
}

function filtrarAtivos(base) {

    let baseFiltrada = {}

    for ([id, recorte] of Object.entries(base)) {
        if (recorte.ocorrencia) baseFiltrada[id] = recorte
    }

    return baseFiltrada

}

async function gerarCorrecoes(idOcorrencia, dadosCorrecoes, corFundo) {

    const correcoes = await recuperarDados('correcoes')

    if (!dadosCorrecoes) return `<div style="${horizontal}; width: 50%; border-radius: 3px; background-color: ${corFundo};"><img src="imagens/BG.png" style="width: 15vw;"></div>`
    let correcoesDiv = ''
    let pagina = 1
    for (const [idCorrecao, recorte] of Object.entries(dadosCorrecoes)) {

        correcoesDiv += `
                <table class="tabelaChamado" name="${idOcorrencia}_${pagina}" style="display: ${pagina == 1 ? '' : 'none'}; width: 100%;">

                    <tbody>

                        <tr>
                            <td><label onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')" style="text-decoration: underline; cursor: pointer; color: #e47a00;">Correção</label></td>
                            <td>${correcoes?.[recorte?.correcao]?.nome || '??'}</td>
                            <td>${recorte.solicitante} > ${recorte.executor}</td>
                        </tr>

                        <tr>
                            <td>Inicio</td>
                            <td>${dtAuxOcorrencia(recorte.dataInicio)}</td>
                            <td style="${horizontal}; justify-content: right;">
                                ${botao('Editar', `formularioCorrecao('${idOcorrencia}', '${idCorrecao}')`)}
                                ${botao('Excluir', `confirmarExclusao('${idOcorrencia}', '${idCorrecao}')`)}
                            </td>
                        </tr>
                        <tr>
                            <td>Descricao</td>
                            <td colspan="2" style="text-align: left;">${recorte.descricao}</td>
                        </tr>

                    </tbody>
                </table>`

        pagina++
    }

    const acumulado = `
            <div class="blocosIrmaos">
                ${correcoesDiv}

                <div style="${horizontal}; gap: 5px; margin-bottom: 1vh; margin-top: 1vh;">
                    <img onclick="ir(this, 'voltar', '${idOcorrencia}')" src="imagens/esq.png" style="width: 1.5vw; cursor: pointer;">
                    <label>1</label>
                    <label>de</label>
                    <label>${pagina - 1}</label>
                    <img onclick="ir(this, 'avancar', '${idOcorrencia}')" src="imagens/dir.png" style="width: 1.5vw; cursor: pointer;">
                </div>
            </div>
        `

    return acumulado

}

async function carregarOcorrencias() {
    removerMenus()
    const dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const sistemas = await recuperarDados('sistemas')
    const tipos = await recuperarDados('tipos')
    const prioridades = await recuperarDados('prioridades')
    const dados_clientes = await recuperarDados('dados_clientes')
    const correcoes = await recuperarDados('correcoes')

    const bgs = (status) => {

        const cores = {
            'Não analisada': 'red',
            'Agendada': 'orange',
            'Solucionada': 'green'
        }

        return cores?.[status] || 'orange'
    }

    let tabelas = ''

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) {

        const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'

        tabelas += `
        <div name="psq_ocorrencias" class="blocoMaior" style="background: linear-gradient(to right,  ${bgs(status)} 50%, ${ocorrencia.correcoes ? 'white' : 'transparent'} 50%); padding-left: 5px;">
            <div class="blocosIrmaos" style="border-right: 1px solid #222;">
                <table class="tabelaChamado">
                    <input name="input_correncias" style="position: absolute; top: 0; left: 0;" type="checkbox">
                    <tbody>

                        <tr>
                            <td style="font-size: 0.8vw;">${status}</td>
                            <td style="text-align: left;">${ocorrencia?.dataRegistro || ''}</td>
                            <td style="text-align: left;">${ocorrencia?.solicitante || ''}</td>
                            <td>
                                <div style="${vertical}; align-items: center;">
                                    <label style="text-align: center;">Dt Limt Exec</label> 
                                    </label>${dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao)}</label>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <label style="text-decoration: underline; cursor: pointer;" onclick="formularioOcorrencia('${idOcorrencia}')">Nº ${idOcorrencia}</label>
                            </td>
                        </tr>

                        <tr>
                            <td>Tipo</td>
                            <td style="text-align: left;">${tipos?.[ocorrencia?.tipo]?.nome || '...'}</td>
                        </tr>

                        <tr>
                            <td>Und Manutenção</td>
                            <td colspan="2" style="text-align: left;">${dados_clientes?.[ocorrencia?.unidade]?.nome || '...'}</td>
                            <td style="${horizontal}; justify-content: right;">
                                ${botao('Incluir Correção', `formularioCorrecao('${idOcorrencia}')`)}
                                ${botao('Excluir', `confirmarExclusao('${idOcorrencia}')`)}
                            </td>
                        </tr>

                        <tr>
                            <td>Sistema</td>
                            <td style="text-align: left;">${sistemas?.[ocorrencia?.sistema]?.nome || '...'}</td>
                        </tr>
                        
                        <tr>
                            <td>Prioridade</td>
                            <td colspan="2" style="text-align: left;">${prioridades?.[ocorrencia?.prioridade]?.nome || '...'}</td>
                        </tr>   
                        
                        <tr>
                            <td>Descrição</td>
                            <td colspan="3" style="text-align: left;">${ocorrencia?.descricao || '...'}</td>
                        </tr>                      
                    
                    </tbody>
                </table>
            </div>

            ${await gerarCorrecoes(idOcorrencia, ocorrencia.correcoes, 'transparent')}
            
        </div>
        `
    }

    let acumulado = `
    
        <div style="${vertical};">
            <div class="painelBotoes" style="justify-content: start; align-items: center;">
                <div style="${horizontal}; gap: 5px;">
                    <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this, 'input_correncias')">
                    <label>Todos</label>
                </div>
                <div style="margin-left: 1vw; ${horizontal}; background-color: white; border-radius: 5px; padding-left: 1vw; padding-right: 1vw;">
                    <input oninput="pesquisar(this, 'ocorrencias')" placeholder="Pesquisar chamados" style="width: 100%;">
                    <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                </div>
                ${botao('Novo', 'formularioOcorrencia()')}
                ${botao('Excluir', ``)}
                ${botao('Baixa', ``)}
                ${botao('Inativar', ``)}
                ${botao('Atualizar', `atualizarOcorrencias()`)}
            </div>

            <div style="height: max-content; width: 85vw; max-height: 70vh; overflow: auto;">
                ${tabelas}
            </div>

            <div class="rodapeTabela"></div>
        </div>
    
    `

    painelCentral.innerHTML = acumulado

}

async function maisLabel({ codigo, quantidade, unidade } = {}) {

    let div = document.getElementById('equipamentos')
    const opcoes = ['UND', 'METRO', 'CX'].map(op => `<option ${unidade == op ? `selected` : ''}>${op}</option>`).join('')
    const temporario = ID5digitos()
    let nome = 'Clique aqui'
    if (codigo) {
        const produto = await recuperarDado('dados_composicoes', codigo)
        nome = produto.descricao
    }

    const label = `
        <div style="${horizontal}; gap: 5px; width: 100%;">
            <input class="campos" type="number" placeholder="quantidade" value="${quantidade || ''}">
            <select class="campos">${opcoes}</select>
            <label class="campos" name="${temporario}" ${codigo ? `id="${codigo}"` : ''} onclick="caixaOpcoes('${temporario}', 'dados_composicoes')">${nome}</label>
            <img src="imagens/cancel.png" style="width: 1.5vw; cursor: pointer;" onclick="this.parentElement.remove()">
        </div> 
    `
    if (codigo) return label

    div.insertAdjacentHTML('beforeend', label)
}

function confirmarExclusao(idOcorrencia, idCorrecao) {

    const funcao = idCorrecao ? `excluirCorrecao('${idOcorrencia}', '${idCorrecao}')` : `excluirOcorrenciaCorrecao('${idOcorrencia}')`

    const acumulado = `
        <div style="background-color: #d2d2d2; ${horizontal}; padding: 2vw; gap: 1vw;">

            <label>Você tem certeza que deseja excluir?</label>

            ${botao('Confirmar', funcao, 'green')}

        </div>
    
    `
    popup(acumulado, 'ALERTA', true)
}

async function excluirOcorrenciaCorrecao(idOcorrencia, idCorrecao) {

    removerPopup()
    overlayAguarde()
    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao]
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
    } else {
        await deletar(`dados_ocorrencias/${idOcorrencia}`)
        await deletarDB('dados_ocorrencias', idOcorrencia)
    }

    await carregarOcorrencias()

    removerOverlay()

}

async function formularioCorrecao(idOcorrencia, idCorrecao) {

    const dados_setores = await recuperarDados('dados_setores')
    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    const correcoes = await recuperarDados('correcoes')
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}
    const funcao = idCorrecao ? `salvarCorrecao('${idOcorrencia}', '${idCorrecao}')` : `salvarCorrecao('${idOcorrencia}')`

    const labelBotao = (chave, nomebase, base) => {

        const id = correcao?.[chave] || undefined

        const possivelValor = base[id]?.nome || base[id]?.usuario || 'Selecionar'

        return `<label class="campos" name="${chave}" ${id ? `id="${id}"` : ''} onclick="caixaOpcoes('${chave}', '${nomebase}')">${possivelValor}</label>`
    }

    let equipamentos = ''
    for (const [id, equip] of Object.entries(correcao?.equipamentos || {})) equipamentos += await maisLabel(equip)

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 2vw; max-height: 60vh; overflow-y: auto; overflow-x: hidden;">
            <div style="${horizontal}; align-items: start; gap: 2vw;">
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Status da Correção', labelBotao('tipoCorrecao', 'correcoes', correcoes))}
                    ${modelo('Data/Hora', `
                        <div style="${horizontal}; gap: 2px;">
                            <input name="dataInicio" class="campos" type="date" value="${correcao?.dataInicio || ''}">
                            <input name="horaInicio" class="campos" type="time" value="${correcao?.horaInicio || ''}">
                        </div>
                        `)}
                    ${modelo('Término', `
                        <div style="${horizontal}; gap: 2px;">
                            <input name="dataTermino" class="campos" type="date" value="${correcao?.dataTermino || ''}">
                            <input name="horaTermino" class="campos" type="time" value="${correcao?.horaTermino || ''}">
                        </div>
                        `)}
                
                </div>
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Solicitante', labelBotao('solicitante', 'dados_setores', dados_setores))}
                    ${modelo('Executor / Responsável', labelBotao('executor', 'dados_setores', dados_setores))}
                    ${modelo('Descrição', `<textarea name="descricao" rows="7" class="campos">${correcao?.descricao || ''}</textarea>`)}

                    <div style="${horizontal}; gap: 5px;">
                        <label>Equipamentos usados</label>
                        <img src="imagens/baixar.png" style="width: 1.5vw; cursor: pointer;" onclick="maisLabel()">
                    </div>
                    
                    <div style="${vertical}; gap: 2px;" id="equipamentos">
                        ${equipamentos}
                    </div>
                </div>
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Anexos', `
                            <label class="campos">
                                Clique aqui
                                <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia}', '${idCorrecao ? idCorrecao : 'novo'}')">
                            </label>
                        `)}
                    <div id="anexos" style="${vertical};">
                        ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}', '${idCorrecao}')`)).join('')}
                    </div>
                </div>
            </div>

        </div>
        <div style="${horizontal}; justify-content: start; background-color: #a0a0a0ff; padding: 5px; gap: 1vw;">
                ${botao('Salvar', funcao)}
        </div>
   `

    popup(acumulado, 'CORREÇÃO')

}

async function formularioOcorrencia(idOcorrencia) {

    const ocorrencia = idOcorrencia ? await recuperarDado('dados_ocorrencias', idOcorrencia) : {}
    const dados_setores = await recuperarDados('dados_setores')
    const dados_clientes = await recuperarDados('dados_clientes')
    const unidades = filtrarAtivos(dados_clientes)
    const sistemas = await recuperarDados('sistemas')
    const prioridades = await recuperarDados('prioridades')
    const tipos = await recuperarDados('tipos')
    const funcao = idOcorrencia ? `salvarOcorrencia('${idOcorrencia}')` : 'salvarOcorrencia()'

    const labelBotao = (chave, nomebase, base) => {

        const id = ocorrencia?.[chave] || undefined

        const possivelValor = base[id]?.nome || base[id]?.usuario || 'Selecionar'

        return `<label class="campos" name="${chave}" ${id ? `id="${id}"` : ''} onclick="caixaOpcoes('${chave}', '${nomebase}')">${possivelValor}</label>`
    }

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 2vw; max-width: 60vw; max-height: 60vh; overflow-y: auto; overflow-x: hidden;">
            <div style="${horizontal}; align-items: start; gap: 2vw;">
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Unidade de Manutenção', labelBotao('unidade', 'dados_clientes', unidades))}
                    ${modelo('Sistema', labelBotao('sistema', 'sistemas', sistemas))}
                    ${modelo('Prioridade', labelBotao('prioridade', 'prioridades', prioridades))}
                </div>
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Tipo', labelBotao('tipo', 'tipos', tipos))}
                    ${modelo('Solicitante', labelBotao('solicitante', 'dados_setores', dados_setores))}
                    ${modelo('Executor / Responsável', labelBotao('executor', 'dados_setores', dados_setores))}
                    ${modelo('Data / Hora', `<label class="campos">${new Date().toLocaleString('pt-BR')}</label>`)}
                    ${modelo('Descrição', `<textarea rows="7" name="descricao" class="campos">${ocorrencia?.descricao || ''}</textarea>`)}
                </div>
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Data Limite para a Execução', `<input name="dataLimiteExecucao" class="campos" type="date" value="${ocorrencia?.dataLimiteExecucao || ''}">`)}
                    ${modelo('Anexos', `
                            <label class="campos">
                                Clique aqui
                                <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia ? idOcorrencia : 'novo'}')">
                            </label>
                        `)}
                    <div id="anexos" style="${vertical};">
                        ${Object.entries(ocorrencia?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')`)).join('')}
                    </div>
                </div>
            </div>
            <hr style="width: 100%;">

            <label>CORREÇÕES</label>

            ${await gerarCorrecoes(idOcorrencia, ocorrencia.correcoes, '#222')}

        </div>
        <div style="${horizontal}; justify-content: start; background-color: #a0a0a0ff; padding: 5px; gap: 1vw;">
                ${botao('Salvar', funcao)}
        </div>
   `

    popup(acumulado, 'OCORRÊNCIA')

}

async function salvarCorrecao(idOcorrencia, idCorrecao) {

    overlayAguarde()

    if (!idCorrecao) idCorrecao = ID5digitos()

    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (!ocorrencia.correcoes) ocorrencia.correcoes = {}

    if (!ocorrencia.correcoes[idCorrecao]) ocorrencia.correcoes[idCorrecao] = {}

    let correcao = ocorrencia.correcoes[idCorrecao]

    Object.assign(correcao, {
        solicitante: obter('solicitante', 'id'),
        executor: obter('executor', 'id'),
        tipoCorrecao: obter('tipoCorrecao', 'id'),
        usuario: acesso.usuario,
        dataInicio: obter('dataInicio', 'value'),
        horaInicio: obter('horaInicio', 'value'),
        dataTermino: obter('dataTermino', 'value'),
        horaTermino: obter('horaTermino', 'value'),
        dataRegistro: new Date().toLocaleString('pt-BR'),
        descricao: obter('descricao', 'value')
    })

    correcao.anexos = {
        ...correcao.anexos,
        ...anexosProvisorios
    }

    const equipamentos = document.getElementById('equipamentos')

    if (equipamentos) {

        const divs = equipamentos.querySelectorAll('div')
        correcao.equipamentos = {}

        for (const div of divs) {

            const campos = div.querySelectorAll('.campos')
            const idEquip = ID5digitos()
            correcao.equipamentos[idEquip] = {
                quantidade: Number(campos[0].value),
                unidade: campos[1].value,
                codigo: campos[2].id
            }
        }
    }

    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)
    await enviar(`dados_ocorrencias/${idOcorrencia}/tipoCorrecao`, correcao.tipoCorrecao)

    ocorrencia.tipoCorrecao = correcao.tipoCorrecao // Atualiza no objeto principal também;

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    await carregarOcorrencias()

    anexosProvisorios = {}
    removerPopup()

}

function obter(name, propriedade) {
    const elemento = document.querySelector(`[name=${name}]`)
    return elemento[propriedade] ? elemento[propriedade] : ''
}

async function salvarOcorrencia(idOcorrencia) {

    overlayAguarde()

    const campos = ['unidade', 'sistema', 'prioridade', 'tipo', 'solicitante', 'executor']
    let ocorrencia = {}

    for (const campo of campos) {
        const resultado = obter(campo, 'id')

        if (resultado == '') return popup(mensagem(`Preencha o campo ${inicialMaiuscula(campo)}`), 'ALERTA', true)

        ocorrencia[campo] = resultado
    }

    ocorrencia.anexos = {
        ...ocorrencia.anexos,
        ...anexosProvisorios
    }
    ocorrencia.usuario = acesso.usuario
    ocorrencia.dataRegistro = new Date().toLocaleString('pt-BR')
    ocorrencia.dataLimiteExecucao = obter('dataLimiteExecucao', 'value')
    ocorrencia.descricao = obter('descricao', 'value')

    if (idOcorrencia) {
        const ocorrenciaAtual = await recuperarDado('dados_ocorrencias', idOcorrencia)
        await inserirDados({ [idOcorrencia]: { ...ocorrencia, ...ocorrenciaAtual } }, 'dados_ocorrencias')
        await enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)
    } else {
        await enviar('dados_ocorrencias/0000', ocorrencia)
        await sincronizarDados('dados_ocorrencias')
    }

    anexosProvisorios = {}
    await carregarOcorrencias()

    removerPopup()
}

async function caixaOpcoes(name, nomeBase) {

    let base = await recuperarDados(nomeBase)

    if (nomeBase.includes('clientes') || nomeBase.includes('composicoes')) base = filtrarAtivos(base)

    let opcoesDiv = ''

    for ([cod, dado] of Object.entries(base)) {

        const labels = esquemaCampos[nomeBase]
            .map(campo => `<label>${dado[campo]}</label>`)
            .join('')

        opcoesDiv += `
            <div name="camposOpcoes" class="atalhos" onclick="selecionar('${name}', '${cod}', '${dado[esquemaCampos[nomeBase][0]]}')" style="${vertical}; gap: 2px; max-width: 40vw;">
                ${labels}
            </div>`
    }

    const acumulado = `
        <div style="${horizontal}; justify-content: left; background-color: #b1b1b1;">
            <div style="${horizontal}; padding-left: 1vw; padding-right: 1vw; margin: 5px; background-color: white; border-radius: 10px;">
                <input oninput="pesquisar(this)" placeholder="Pesquisar itens" style="width: 100%;">
                <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
            </div>
        </div>
        <div style="padding: 1vw; gap: 5px; ${vertical}; background-color: #d2d2d2; width: 30vw; max-height: 40vh; height: max-content; overflow-y: auto; overflow-x: hidden;">
            ${opcoesDiv}
        </div>
    `

    popup(acumulado, 'Selecione o item', true)

}

function selecionar(name, id, termo) {
    const elemento = document.querySelector(`[name='${name}']`)
    elemento.textContent = termo
    elemento.id = id
    removerPopup()
}

function pesquisar(input, tituloAtual) {

    const termoPesquisa = String(input.value).toLowerCase()

    const divs = document.querySelectorAll(`[name=${tituloAtual ? `psq_${tituloAtual}` : 'camposOpcoes'}]`)

    for (const div of divs) {

        const termoDiv = String(div.textContent).toLocaleLowerCase()

        div.style.display = (termoDiv.includes(termoPesquisa) || termoPesquisa == '') ? '' : 'none'

    }

}

async function anexosOcorrencias(input, idOcorrencia, idCorrecao) {

    overlayAguarde()

    const divAnexos = document.getElementById('anexos')
    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    let objeto = {}
    const anexos = await importarAnexos(input)
    const novo = (idCorrecao == 'novo' || idOcorrencia == 'novo')

    if (novo) {
        objeto = anexosProvisorios
    } else if (idCorrecao) {
        if (!ocorrencia.correcoes[idCorrecao].anexos) ocorrencia.correcoes[idCorrecao].anexos = {}
        objeto = ocorrencia.correcoes[idCorrecao].anexos
    } else {
        if (!ocorrencia.anexos) ocorrencia.anexos = {}
        objeto = ocorrencia.anexos
    }

    anexos.forEach(anexo => {
        const idAnexo = ID5digitos()
        objeto[idAnexo] = anexo

        if (divAnexos) divAnexos.insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}' ${idCorrecao ? `, '${idCorrecao}'` : ''})`))

    })

    if(!novo) await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    removerOverlay()

}


async function removerAnexo(img, idAnexo, idOcorrencia, idCorrecao) {

    overlayAguarde()

    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao].anexos[idAnexo]
    } else {
        delete ocorrencia.anexos[idAnexo]
    }

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    img.parentElement.remove()

    removerOverlay()

}