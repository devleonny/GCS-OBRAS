let painelCentral = document.querySelector('.painelCentral')
let filtrosOcorrencias = { chamados: {} }
let anexosProvisorios = {}

const btn = (imagem, termo, link) => `
    <div class="btnLateral" onclick="${link ? link : `opcoesPainel('${termo}')`}">
        <img src="imagens/${imagem}.png" style="width: 1.5vw;">
        <label>${termo}</label>
    </div>
`

const labelBotao = (chave, nomebase, base, dados) => {

    const id = dados?.[chave] || undefined

    const possivelValor = base[id]?.nome || base[id]?.usuario || 'Selecionar'

    return `
        <div style="${horizontal}; justify-content: start; gap: 5px;">
            <span class="fechar" onclick="removerCampo(this)">×</span>
            <label class="campos" name="${chave}" ${id ? `id="${id}"` : ''} onclick="caixaOpcoes('${chave}', '${nomebase}')">${possivelValor}</label>
        </div>
    `
}

function removerCampo(img) {

    let label = img.nextElementSibling
    label.removeAttribute('id')
    label.textContent = 'Selecionar'

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

const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; gap: 5px; width: 100%;">
        <label style="width: 40%; text-align: right;"><strong>${valor1}</strong></label>
        <div style="width: 60%; text-align: justify; padding-right: 1vw;">${elemento}</div>
    </div>
`

botoesLaterais()
//dashboard()
//carregarOcorrencias()
//painelCadastro('dados_clientes')
//telaConfiguracoes()


async function telaConfiguracoes() {

    overlayAguarde()

    const acumulado = `
    <div style="${vertical}; gap: 1vh;">
        <div style="${horizontal}; gap: 10px; align-items: start;">
            ${await carregarTabelasAuxiliares('empresas')}
            ${await carregarTabelasAuxiliares('sistemas')}
            ${await carregarTabelasAuxiliares('prioridades')}
            ${await carregarTabelasAuxiliares('correcoes')}
            ${await carregarTabelasAuxiliares('tipos')}
        </div>
    </div>
    `

    painelCentral.innerHTML = acumulado

    removerOverlay()
}

async function atualizarOcorrencias() {

    await sincronizarDados('dados_ocorrencias')
    await carregarOcorrencias()

}

async function botoesLaterais() {

    const empresas = await recuperarDados('empresas')
    let empresaAtiva = document.getElementById('empresaAtiva')
    empresaAtiva.textContent = empresas?.[acesso?.empresa]?.nome || 'Usuário sem Grupo'

    let painelLateral = document.querySelector('.painelLateral')

    const acumulado = `
        ${btn('chamados', 'Nova Ocorrência', 'formularioOcorrencia()')}
        ${btn('megafone', 'Ocorrências', `carregarOcorrencias()`)}
        ${btn('relatorio', 'Dashboard', `dashboard()`)}
        ${btn('empresa', 'Unidades', `painelCadastro('dados_clientes')`)}
        ${btn('composicoes', 'Equipamentos', `painelCadastro('dados_composicoes')`)}
        ${btn('ajustar', 'Cadastros', `telaConfiguracoes()`)}
        ${btn('gerente', 'Usuários', `usuarios()`)}
        ${btn('LG', 'GCS', `window.location.href='inicial.html'`)}
    `

    painelLateral.innerHTML = acumulado

}

async function usuarios() {

    const dados_setores = await recuperarDados('dados_setores')
    const empresas = await recuperarDados('empresas')
    let linhas = ''

    for (const [usuario, dados] of Object.entries(dados_setores)) {
        const opcoesEmpresas = Object.entries(empresas).reverse()
            .map(([id, empresa]) => `<option value="${id}" ${dados.empresa == id ? 'selected' : ''}>${empresa.nome}</option>`).join('')

        linhas += `
            <tr>
                <td>${usuario}</td>
                <td>${dados.setor}</td>
                <td><select>${opcoesEmpresas}</select></td>
                <td>
                    <div style="${horizontal}; gap: 5px;">
                        <img src="imagens/atualizar3.png" style="width: 1.5vw; cursor: pointer;" onclick="alterarMobi7('${usuario}')">
                        <label>${dados?.mobi7 || ''}</label>
                    </div>
                </td>
            </tr>
        `
    }

    const acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes" style="align-items: center;">
                <label style="padding: 1vw;">Gerenciar Usuários</label>
            </div>
            <div style="height: 50vh; overflow-y: auto;">
                <table class="tabela">
                    <tbody>${linhas}</tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    painelCentral.innerHTML = acumulado

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

async function painelCadastro(nomeBaseReferencia, codigoEmpresa) {

    removerMenus()
    document.title = '...'
    await sincronizarDados(nomeBaseReferencia)
    document.title = 'Ocorrências'

    overlayAguarde()

    const dadosReferencia = await recuperarDados(nomeBaseReferencia)
    const empresas = await recuperarDados('empresas')
    const opcoes = Object.entries(empresas)
        .map(([id, empresa]) => `<option value="${id}" ${codigoEmpresa == id ? 'selected' : ''}>${empresa.nome}</option>`).join('')
    const tabelas = tabelasHTML(codigoEmpresa ? codigoEmpresa : Object.keys(empresas)[0])

    const divTabelasString = `
        <div style="display: flex; align-items: start; justify-content: center; width: 100%;">
            ${tabelas.referencia}

            <div style="border-right: 1px dashed #d2d2d2; margin: 1vw; height: 80vh;"></div>

            ${tabelas.ativos}
        </div>
    `

    const acumulado = `
        <div style="${vertical}; gap: 10px;">

            <div style="${horizontal}; gap: 5px;">
                <label style="color: white; white-space: nowrap;">Selecione o Grupo</label>
                <select class="opcoesSelect" onchange="painelCadastro('${nomeBaseReferencia}', this.value)">${opcoes}</select>
            </div>

            <div style="${horizontal}; width: 85vw;" id="divTabelas">
                ${divTabelasString}
            </div>
        </div>
    `

    removerOverlay()

    let divTabelas = document.getElementById('divTabelas')
    if (divTabelas) return divTabelas.innerHTML = divTabelasString
    painelCentral.innerHTML = acumulado

    // Função que carrega os elementos;
    function tabelasHTML(codigoEmpresa) {

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
                .map(campo => modeloCampos(String(campo).toUpperCase(), recorte?.[campo] || '??'))
                .join('')

            linhas.referencia.quantidade++
            linhas.referencia.string += `
                <div name="psq_referencia" class="divsListagem">
                    <div style="${vertical}; width: 100%; position: relative;">
                        <input name="referencia" id="${cod}" type="checkbox" style=" position: absolute; top: 0; left: 0; width: 1.5vw; height: 1.5vw;">
                        ${labels}
                    </div>
                </div>`

            if (recorte.ocorrencia && recorte.ocorrencia.includes(codigoEmpresa)) {
                linhas.ativos.quantidade++
                linhas.ativos.string += `
                <div name="psq_ativos" class="divsListagem">
                    <input name="ativos" id="${cod}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                    <div style="${vertical}; width: 100%;">

                        ${labels}

                    </div>
                </div>`}
        })

        for (const [tabela, conteudo] of Object.entries(linhas)) {

            tabelas[tabela] = `
                <div style="width: 50%;">
                    <label style="font-size: 2.0vw; color: white;">${inicialMaiuscula(tabela)} - ${conteudo.quantidade}</label>
                    <div class="painelBotoes" style="justify-content: start; align-items: center; gap: 1vw;">
                        <div style="${horizontal}; gap: 5px;">
                            <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this, '${tabela}')">
                            <label>Todos</label>
                        </div>

                        <div style="${horizontal}; background-color: white; border-radius: 5px; padding-left: 1vw; padding-right: 1vw;">
                            <input oninput="pesquisar(this, '${tabela}')" placeholder="Pesquisar" style="width: 100%;">
                            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                        </div>

                        ${botao(tabela == 'referencia' ? 'Incluir' : 'Remover', `gerenciar('${tabela}', '${nomeBaseReferencia}', '${codigoEmpresa}')`)}
                    </div>

                    <div style="width: 100%; height: max-content; max-height: 50vh; overflow-y: auto; overflow-x: hidden;">
                        ${conteudo.string}
                    </div>
                    <div class="rodapeTabela"></div>
                </div>
           `

        }

        return tabelas
    }

}

async function gerenciar(tabela, nomeBaseReferencia, codigoEmpresa) {
    overlayAguarde();

    let dadosReferencia = await recuperarDados(nomeBaseReferencia);
    let inputs = document.querySelectorAll(`[name="${tabela}"]`);
    const registrar = tabela == 'referencia';

    let alteracoes = {
        registrar,
        codigoEmpresa,
        nomeBaseReferencia,
        listagem: []
    };

    for (let inputTab of inputs) {
        if (inputTab.checked) {
            const id = inputTab.id;
            const recorte = dadosReferencia[id];
            if (!recorte.ocorrencia) recorte.ocorrencia = [];

            if (registrar) {

                if (!recorte.ocorrencia.includes(codigoEmpresa)) {
                    recorte.ocorrencia.push(codigoEmpresa);
                }

            } else {

                recorte.ocorrencia = recorte.ocorrencia.filter(cod => cod !== codigoEmpresa);
                if (recorte.ocorrencia.length === 0) delete recorte.ocorrencia;
            }

            alteracoes.listagem.push(id)
        }
    }

    await ativarChaveOcorrencias(alteracoes)
    await inserirDados(dadosReferencia, nomeBaseReferencia);
    await painelCadastro(nomeBaseReferencia, codigoEmpresa);
    removerOverlay();
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
    await sincronizarDados(nomeBaseAuxiliar, true)

    const baseAuxiliar = await recuperarDados(nomeBaseAuxiliar)

    const linhas = Object.entries(baseAuxiliar)
        .map(([cod, recorte]) => `
        <tr>
            <td>
                <div style="${horizontal}; justify-content: start; gap: 10px;">
                    <img onclick="editar('${nomeBaseAuxiliar}', '${cod}')" src="imagens/pesquisar2.png" style="cursor: pointer; width: 1.5vw;">
                    <label>${recorte.nome}</label>
                </div>
            </td>
        </tr>
        `).join('')

    let acumulado = `
        <div style="${vertical};" id="${nomeBaseAuxiliar}">
            <div class="painelBotoes" style="align-items: center;">
                ${botao('Novo', `editar('${nomeBaseAuxiliar}')`)}
                <label style="font-size: 1.2vw;">${inicialMaiuscula(nomeBaseAuxiliar)}</label>
            </div>
            <div style="height: max-content; max-height: 60vh; overflow-y: auto; width: 15vw;">
                <table class="tabela" style="width: 100%;">
                    <thead>
                        <th>Nome</th>
                    </thead>

                    <tbody>
                        ${linhas}
                    </tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    let tabelaExistente = document.getElementById(nomeBaseAuxiliar)
    if (tabelaExistente) return tabelaExistente.innerHTML = acumulado
    return acumulado
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
            ${acesso.permissao == 'adm' ? botao('Excluir', `excluir('${cod}', '${tabela}')`, '#B12425') : ''}
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

    if (!dt || '') return '--'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

function filtrarAtivos(base) {

    let baseFiltrada = {}

    for ([id, recorte] of Object.entries(base)) {
        if (recorte.ocorrencia) baseFiltrada[id] = recorte
    }

    return baseFiltrada

}

async function gerarCorrecoes(idOcorrencia, dadosCorrecoes, ativarRelatorio) {

    const correcoes = await recuperarDados('correcoes')
    let correcoesDiv = ''
    let pagina = 1
    for (const [idCorrecao, recorte] of Object.entries(dadosCorrecoes)) {

        correcoesDiv += `
            <div id="${idOcorrencia}_${pagina}" name="${idCorrecao}" style="${horizontal}; display: ${pagina == 1 ? 'flex' : 'none'}; width: 100%;">

                <div style="${vertical}; gap: 5px; width: ${ativarRelatorio ? '50%' : '100%'};">

                    <div style="${horizontal}; justify-content: right; width: 100%;">
                        ${botao('Editar', `formularioCorrecao('${idOcorrencia}', '${idCorrecao}')`)}
                        ${botao('Excluir', `confirmarExclusao('${idOcorrencia}', '${idCorrecao}')`, '#B12425')}
                    </div>

                    ${modeloCampos('Solicitante > Executor', `<label style="white-space: nowrap;">${recorte?.solicitante || '??'} > ${recorte?.executor || '??'}</label>`)}
                    ${modeloCampos('Status Correção', correcoes?.[recorte?.tipoCorrecao]?.nome || '??')}
                    ${modeloCampos('Início', dtAuxOcorrencia(recorte.dataInicio))}
                    ${modeloCampos('Término', dtAuxOcorrencia(recorte.dataTermino))}
                    ${modeloCampos('Descrição', recorte.descricao)}
                </div>

                ${ativarRelatorio
                ? `<div id="${idCorrecao}" class="fundoTec">
                        <div style="${horizontal}; gap: 5px;">
                            <img src="gifs/loading.gif" style="width: 5vw;">
                            <label>Carregando...</label>
                        </div>
                    </div>`
                : ''}

            </div>
            `

        pagina++
    }

    const acumulado = `
        <div style="${vertical}; align-items: center; background-color: white; width: 100%;">
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

function ir(img, acao, idOcorrencia) {
    const tabelas = document.querySelectorAll(`[id^='${idOcorrencia}_']`)
    const paginaAtual = img.closest('div').querySelectorAll('label')[0]
    if (!paginaAtual) return

    const numeroAtual = Number(paginaAtual.textContent)
    const proximoNumero = acao === 'avancar' ? numeroAtual + 1 : numeroAtual - 1
    const novaPagina = document.querySelectorAll(`[id=${idOcorrencia}_${proximoNumero}]`)
    const idCorrecao = novaPagina[0].getAttribute('name')

    if (novaPagina.length == 0) return

    for (const tabela of tabelas) tabela.style.display = 'none'
    novaPagina.forEach(pag => pag.style.display = 'flex')
    paginaAtual.textContent = proximoNumero

    carregarRoteiro(idOcorrencia, idCorrecao)
}

async function carregarRoteiro(idOcorrencia, idCorrecao) {

    let painel = document.getElementById(idCorrecao)
    if (!painel) return

    const mensagem = (texto) => `<div style="${horizontal}; width: 100%;">${texto}</div>`

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    const correcao = ocorrencia.correcoes[idCorrecao]
    const dadosUsuario = await recuperarDado('dados_setores', correcao.executor)
    const usuarioMobi7 = dadosUsuario?.mobi7 || ''
    const dtInicial = correcao.dataInicio
    const dtFinal = correcao.dataTermino


    if (usuarioMobi7 == '' || dtInicial == '' || dtFinal == '') return painel.innerHTML = mensagem('Correção sem dados de Inicio/Final e/ou Executor')

    const roteiro = await mobi7({ usuarioMobi7, dtInicial, dtFinal })

    if (roteiro.length == 0) return painel.innerHTML = mensagem('Sem Dados')

    const modelo = (valor1, valor2) => `
        <div style="${horizontal}; gap: 5px;">
            <label style="font-size: 0.7vw;"><strong>${valor1}</strong></label>
            <label style="font-size: 0.7vw; text-align: left;">${valor2}</label>
        </div>
    `

    let locais = ''
    for (const registro of roteiro.reverse()) {

        const partida = registro.startLocation
        const dtPartida = new Date(registro.startPosition.date).toLocaleString('pt-BR')

        const chegada = registro.endLocation
        const dtChegada = new Date(registro.endPosition.date).toLocaleString('pt-BR')

        locais += `
            <div style="${horizontal}; gap: 1vw; width: 100%;">
                <div style="${vertical}; width: 50%;">
                    ${modelo('Bairro', partida.district)}
                    ${modelo('Rua', partida.street)}
                    ${modelo('Saída', dtPartida)}
                </div>

                <div style="${vertical}; width: 50%;">
                    ${modelo('Bairro', chegada.district)}
                    ${modelo('Rua', chegada.street)}
                    ${modelo('Saída', dtChegada)}
                </div>
            </div>
            <br>
        `
    }

    painel.innerHTML = locais

}

async function carregarOcorrencias() {

    overlayAguarde()

    removerMenus()
    const resposta = await baixarOcorrencias()
    const dados_ocorrencias = resposta.dados
    document.getElementById('empresaAtiva').textContent = resposta.empresa
    const sistemas = await recuperarDados('sistemas')
    const tipos = await recuperarDados('tipos')
    const prioridades = await recuperarDados('prioridades')
    const dados_clientes = await recuperarDados('dados_clientes')
    const correcoes = await recuperarDados('correcoes')

    let linhas = ''

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) {

        const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'

        linhas += `
        <tr>
            
            <td style="background-color: white;">
              
                <div style="${vertical}; gap: 5px; width: 100%;">

                    <input name="input_correncias" style="position: absolute; top: 0; left: 0; width: 1.5vw; height: 1.5vw;" type="checkbox">

                    <div style="${horizontal}; justify-content: right; width: 100%;">
                        ${botao('Editar', `formularioOcorrencia('${idOcorrencia}')`, '#222')}
                        ${botao('Incluir Correção', `formularioCorrecao('${idOcorrencia}')`, '#e47a00')}
                        ${botao('Excluir', `confirmarExclusao('${idOcorrencia}')`, '#B12425')}
                    </div>

                    ${modeloCampos('Última Correção', status)}
                    ${modeloCampos('Data Registro', ocorrencia?.dataRegistro || '')}
                    ${modeloCampos('Quem abriu', ocorrencia?.solicitante || '')}
                    ${modeloCampos('Dt Limt Execução', dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao))}
                    ${modeloCampos('Número', idOcorrencia)}
                    ${modeloCampos('Tipo', tipos?.[ocorrencia?.tipo]?.nome || '...')}
                    ${modeloCampos('Und Manutenção', dados_clientes?.[ocorrencia?.unidade]?.nome || '...')}
                    ${modeloCampos('Sistema', sistemas?.[ocorrencia?.sistema]?.nome || '...')}
                    ${modeloCampos('Prioridade', prioridades?.[ocorrencia?.prioridade]?.nome || '...')}
                    ${modeloCampos('Descrição ', ocorrencia?.descricao || '...')}
                    <br>
                </div>

            </td>
            
            ${ocorrencia.correcoes
                ? `<td style="background-color: white;">${await gerarCorrecoes(idOcorrencia, ocorrencia.correcoes)}</td>`
                : `<td>
                    <div style="${horizontal}; border-radius: 3px;">
                        <img src="imagens/BG.png" style="width: 15vw;">
                    </div>
                </td>`}
        </tr>
        `
    }

    let acumulado = `
    
        <div style="${vertical};">
            <div class="painelBotoes" style="justify-content: space-between; align-items: center; height: 5vh;">
                <div style="${horizontal}; gap: 5px;">
                    <div style="${horizontal}; gap: 5px;">
                        <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this, 'input_correncias')">
                        <label>Todos</label>
                    </div>
                    <div style="margin-left: 1vw; ${horizontal}; background-color: white; border-radius: 5px; padding-left: 1vw; padding-right: 1vw;">
                        <input oninput="pesquisar(this, 'ocorrencias')" placeholder="Pesquisar chamados" style="width: 100%;">
                        <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                    </div>
                </div>
                <div style="${horizontal}; gap: 5px;">
                    ${botao('Novo', 'formularioOcorrencia()')}
                    ${botao('Excluir', ``, '#B12425')}
                    ${botao('Baixa', ``)}
                    ${botao('Inativar', ``)}
                    ${botao('Atualizar', `atualizarOcorrencias()`)}
                </div>
            </div>

            <div style="height: max-content; width: 85vw; max-height: 70vh; overflow: auto;">
                <table class="tabela1">
                    <tbody>${linhas}</tbody>
                </table>
            </div>

            <div class="rodapeTabela"></div>
        </div>
    `

    painelCentral.innerHTML = acumulado

    removerOverlay()

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

    let equipamentos = ''
    for (const [id, equip] of Object.entries(correcao?.equipamentos || {})) equipamentos += await maisLabel(equip)

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 2vw; max-height: 60vh; overflow-y: auto; overflow-x: hidden;">
            <div style="${horizontal}; align-items: start; gap: 2vw;">
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Status da Correção', labelBotao('tipoCorrecao', 'correcoes', correcoes, correcao))}
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
                    ${modelo('Solicitante', labelBotao('solicitante', 'dados_setores', dados_setores, correcao))}
                    ${modelo('Executor / Responsável', labelBotao('executor', 'dados_setores', dados_setores, correcao))}
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

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 2vw; max-width: 60vw; max-height: 60vh; overflow-y: auto; overflow-x: hidden;">
            <div style="${horizontal}; align-items: start; gap: 2vw;">
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Unidade de Manutenção', labelBotao('unidade', 'dados_clientes', unidades, ocorrencia))}
                    ${modelo('Sistema', labelBotao('sistema', 'sistemas', sistemas, ocorrencia))}
                    ${modelo('Prioridade', labelBotao('prioridade', 'prioridades', prioridades, ocorrencia))}
                </div>
                <div style="${vertical}; gap: 1vh;">
                    <div style="${horizontal}; align-items: start; gap: 1vw;">
                        <div style="${vertical}; gap: 5px;">
                            ${modelo('Tipo', labelBotao('tipo', 'tipos', tipos, ocorrencia))}
                            ${modelo('Solicitante', labelBotao('solicitante', 'dados_setores', dados_setores, ocorrencia))}
                            ${modelo('Executor / Responsável', labelBotao('executor', 'dados_setores', dados_setores, ocorrencia))}
                            ${modelo('Data / Hora', `<label class="campos">${new Date().toLocaleString('pt-BR')}</label>`)}
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
                    ${modelo('Descrição', `<textarea rows="7" style="width: 100%;" name="descricao" class="campos">${ocorrencia?.descricao || ''}</textarea>`)}
                </div>
            </div>

            ${ocorrencia.correcoes
            ? `<hr style="width: 100%;">
                <label>CORREÇÕES</label>
                ${await gerarCorrecoes(idOcorrencia, ocorrencia.correcoes, true)}`
            : ''}

        </div>
        <div style="${horizontal}; justify-content: start; background-color: #a0a0a0ff; padding: 5px; gap: 1vw;">
                ${botao('Salvar', funcao)}
        </div>
   `

    popup(acumulado, 'OCORRÊNCIA')

    carregarRoteiro(idOcorrencia, Object.keys(ocorrencia?.correcoes || {})[0])

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

    ocorrencia.tipoCorrecao = correcao.tipoCorrecao // Atualiza no objeto principal também;

    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)
    await enviar(`dados_ocorrencias/${idOcorrencia}/tipoCorrecao`, correcao.tipoCorrecao)
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
        await inserirDados({ [idOcorrencia]: { ...ocorrenciaAtual, ...ocorrencia } }, 'dados_ocorrencias')
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

    if (!novo) await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

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

function diferencaEmDias(data1, data2) {

    if (data1 == '' || data2 == '') return 0
    const dt1 = new Date(data1)
    const dt2 = new Date(data2)

    const diffMs = dt1 - dt2
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return diffDias
}

async function dashboard(dadosFiltrados) {

    removerMenus()

    let dados_ocorrencias = {}
    if (dadosFiltrados) {
        dados_ocorrencias = dadosFiltrados
    } else {
        const resposta = await baixarOcorrencias()
        dados_ocorrencias = resposta.dados
    }

    const dados_clientes = await recuperarDados('dados_clientes')
    const correcoes = await recuperarDados('correcoes')

    let linhas = ''
    let contador = {
        abertos: 0,
        atrasados: 0,
        finalizados: 0
    }

    const totalOcorrencias = Object.keys(dados_ocorrencias).length

    const balao = (valor1, valor2) => `
        <div class="balaoOcorrencias">
            <div class="balaoSolicitante">${valor1 || '--'}</div>
            <div class="balaoExecutor">${valor2 || '--'}</div>
        </div>
    `

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias)) {

        let dtTermino = ''
        let baloes = ''

        for (const [idCorrecao, correcao] of Object.entries(ocorrencia?.correcoes || {})) {
            if (correcao.dataTermino !== '') dtTermino = correcao.dataTermino
            baloes += balao(correcao?.solicitante, correcao?.executor)
        }

        if (!ocorrencia.correcoes) baloes += balao('--', '--')

        const dias = diferencaEmDias(ocorrencia.dataLimiteExecucao, dtTermino)

        if (dias > 0 && dtTermino !== '') {
            contador.finalizados++
        } else if (dias < 0 && dtTermino !== '') {
            contador.atrasados++
        } else if (dtTermino == '') {
            contador.abertos++
        }

        linhas += `
            <tr>
                <td>${idOcorrencia}</td>
                <td>${dados_clientes[ocorrencia.unidade].nome}</td>
                <td>${ocorrencia.dataRegistro.split(',')[0]}</td>
                <td>${dtAuxOcorrencia(ocorrencia.dataLimiteExecucao)}</td>
                <td>${dtAuxOcorrencia(dtTermino)}</td>
                <td style="text-align: center; ${dias < 0 ? 'background-color: #b12425; color: white;' : ''}">${dias}</td>
                <td>${correcoes?.[ocorrencia.tipoCorrecao]?.nome || ''}</td>
                <td>
                    <div style="${vertical}; gap: 2px;">
                        ${baloes}
                    </div>
                </td>
                <td style="text-align: center;">
                    <div style="${horizontal};">
                        <img src="imagens/pesquisar2.png" style="width: 1.5vw; cursor: pointer;" onclick="formularioOcorrencia('${idOcorrencia}')">
                    </div>
                </td>
            </tr>
        `
    }

    let cabecalho = { th: '', thPesquisa: '' }
    const colunas = ['Chamado', 'Loja', 'Data Abertura', 'Data Limite', 'Data Execução', 'Dias', 'Status Correção', 'Solicitante > Executor', 'Detalhes']
        .map(op => {
            cabecalho.th += `<th>${op}</th>`
        })

    const totaisLabel = (porc, texto, total, cor) => `
        <div class="totalBox" style="background-color: ${cor ? cor : '#222'};">
            <label style="font-size: 1.2vw;">${porc}</label>
            <label style="font-size: 1.5vw;">${texto}</label>
            <label style="font-size: 2.0vw;"><strong>${total}</strong></label>
        </div>
    `

    const modelo = (titulo, html, name, nomeBase) => {

        html = html ? html : `
            <label class="campos" onclick="caixaOpcoesRelatorio('${name}', '${nomeBase}')">Selecionar</label>
            <br>
            <div name="${name}"></div>
        `
        const bloco = `
            <div class="blocoFiltro">
                <label>${titulo}</label>
                ${html}
            </div>
       `
        return bloco
    }

    const porcentagem = (valor) => `${((valor / totalOcorrencias) * 100).toFixed(0)}%`

    const tabela = `
        <div style="heigth: max-content; heinght: 60vw; overflow-y auto;" id="tabelaRelatorio">
            <table class="tabela">
                <thead>
                    <tr>${cabecalho.th}</tr>
                </thead>
                <tbody id="bodyOcorrencias">${linhas}</tbody>
            </table>
        </div>
    `

    const pesquisa = (campo, col) => `
        <div style="${horizontal}; padding-left: 1vw; padding-right: 1vw; margin: 5px; background-color: white; border-radius: 10px;">
            <input oninput="pesquisar_generico('${col}', this.value, filtrosOcorrencias.chamados, 'bodyOcorrencias')" placeholder="Pesquisar ${campo}" style="width: 100%;">
            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
        </div>
    `

    const acumulado = `

        <div style="${horizontal}; align-items: start; gap: 10px;">

            <div style="${vertical}; width: 75%;">
                <div class="painelBotoes">
                    <label class="tituloDashboard">Relatório de Chamados</label>
                </div>
                <div style="${horizontal}; gap: 2px; justify-content: space-evenly; width: 100%; align-items: start; background-color: #a3a3a3; width: 100%; padding-top: 10px; padding-bottom: 10px;">
                    <div style="${vertical}; gap: 5px;">
                        <div style="${horizontal}; gap: 5px;">
                            ${modelo('Dt Início', `<input class="campos" type="date">`)}
                            ${modelo('Dt Término', `<input class="campos" type="date">`)}
                        </div>
                        ${pesquisa('lojas', 1)}
                        ${pesquisa('chamados', 0)}
                    </div>
                    ${modelo('Solicitante', false, 'solicitante', 'dados_setores')}
                    ${modelo('Executor', false, 'executor', 'dados_setores')}
                    ${modelo('Status da Correção', false, 'tipoCorrecao', 'correcoes')}
                    ${modelo('Status de Finalização', false, 'tipoCorrecao', 'correcoes')}
                </div>
                ${tabela}
                <div class="rodapeTabela"></div>
            </div>

            <div style="${vertical}; gap: 2vh; width: 25%;">
                ${totaisLabel('', 'Total de Chamados', Object.entries(dados_ocorrencias).length, '#00563f')}
                ${totaisLabel(porcentagem(contador.finalizados), 'Finalizados no Prazo', contador.finalizados, 'green')}
                ${totaisLabel(porcentagem(contador.abertos), 'Em Aberto', contador.abertos, '#a28409')}
                ${totaisLabel(porcentagem(contador.atrasados), 'Atrasados', contador.atrasados, '#B12425')}
            </div>

        </div>
    `

    const tabelaRelatorio = document.getElementById('tabelaRelatorio')
    if (tabelaRelatorio) return tabelaRelatorio.innerHTML = tabela

    painelCentral.innerHTML = acumulado

}

async function caixaOpcoesRelatorio(name, nomeBase) {

    let base = await recuperarDados(nomeBase);

    if (nomeBase.includes('clientes') || nomeBase.includes('composicoes')) base = filtrarAtivos(base)

    const bloco = document.querySelector(`[name='${name}']`)
    const permitidos = []
    if (bloco) {
        const labels = bloco.querySelectorAll('label')
        for (const label of labels) if (!permitidos.includes(label.id)) permitidos.push(label.id)
    }

    let opcoesDiv = `
        <div name="camposOpcoes" class="atalhosRelatorio">
            <input ${permitidos.includes('Em Branco') ? 'checked' : ''} name="itensFiltro" id="Em Branco" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
            <label id="Em Branco">Em Branco</label>
        </div>
    `

    for ([cod, dado] of Object.entries(base)) {

        const labels = esquemaCampos[nomeBase]
            .map(campo => `
                <label id="${cod}">${dado[campo]}</label>
                ${nomeBase == 'dados_setores' ? `<label style="font-size: 0.7vw;">${dado.setor}</label>` : ''}
                `)
            .join('')

        opcoesDiv += `
            <div name="camposOpcoes" class="atalhosRelatorio">
                <input ${permitidos.includes(cod) ? 'checked' : ''} name="itensFiltro" id="${cod}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                ${labels}
            </div>`
    }

    const acumulado = `
        <div style="${horizontal}; justify-content: left; background-color: #b1b1b1; gap: 1vw; padding: 1vw;">
            <div style="${horizontal}; gap: 5px;">
                <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this, 'itensFiltro')">
                <label>Todos</label>
            </div>
            <img src="imagens/concluido.png" style="width: 2vw; cursor: pointer;" onclick="filtrarRelatorio('${name}')">
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

async function filtrarRelatorio(nameBloco) {

    let bloco = document.querySelector(`[name='${nameBloco}']`)

    if (bloco) {

        bloco.innerHTML = ''
        const checkboxes = document.querySelectorAll(`[name='itensFiltro']`)

        for (const input of checkboxes) {

            if (input.checked) {
                const labels = input.parentElement.querySelectorAll('label')
                const item = `
                    <label name="${nameBloco}_filtros" id="${labels[0].id}" style="${horizontal}; justify-content: start; gap: 5px; width: 100%;">
                        <img src="imagens/cancel.png" style="width: 1.2vw; cursor: pointer;" onclick="this.parentElement.remove(); processarFiltros()">
                        ${labels[0].textContent}
                    </label>
                `
                bloco.insertAdjacentHTML('beforeend', item)
            }
        }
    }

    await processarFiltros()
    removerPopup()
}

async function processarFiltros() {

    let dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    let dadosFiltrados = {}

    let permitidos = {
        solicitante: [],
        executor: [],
        tipoCorrecao: []
    }

    for (let [nameBloco, objeto] of Object.entries(permitidos)) {
        const bloco = document.querySelector(`[name='${nameBloco}']`)

        if (bloco) {
            const labels = bloco.querySelectorAll('label')
            for (const label of labels) if (!objeto.includes(label.id)) objeto.push(label.id)
        }
    }

    const vazio = () => {

        let estaVazio = true
        for (const [name, lista] of Object.entries(permitidos)) {
            if (lista.length > 0) estaVazio = false
        }

        return estaVazio
    }

    const filtrado = (lista1, lista2) => {

        let exibir = true
        for (const item of lista1) {
            if (!lista2.includes(item)) exibir = false
        }

        return exibir
    }

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias)) {

        let campos = {
            solicitante: new Set(),
            executor: new Set(),
            tipoCorrecao: new Set()
        }

        for (const [idCorrecao, correcao] of Object.entries(ocorrencia?.correcoes || {})) {
            campos.solicitante.add(correcao?.solicitante || 'Em Branco')
            campos.executor.add(correcao?.executor || 'Em Branco')
            campos.tipoCorrecao.add(correcao?.tipoCorrecao || 'Em Branco')
        }

        if (!ocorrencia.correcoes) {
            campos.solicitante.add('Em Branco')
            campos.executor.add('Em Branco')
            campos.tipoCorrecao.add('Em Branco')
        }

        let permSolicitante = filtrado(permitidos.solicitante, [...campos.solicitante])
        let permExecutor = filtrado(permitidos.executor, [...campos.executor])
        let permCorrecao = filtrado(permitidos.tipoCorrecao, [...campos.tipoCorrecao])

        if ((permSolicitante && permExecutor && permCorrecao) || vazio()) {
            dadosFiltrados[idOcorrencia] = ocorrencia
        }

    }

    await dashboard(dadosFiltrados)

}