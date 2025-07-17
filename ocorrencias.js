let painelCentral = document.querySelector('.painelCentral')
let filtrosOcorrencias = {}

const btn = (imagem, termo) => `
    <div class="btnLateral" onclick="opcoesPainel('${termo}')">
        <img src="imagens/${imagem}.png" style="width: 1.5vw;">
        <label>${termo}</label>
    </div>
`

const menus = {
    'Início': {
        imagem: 'LG',
        paineis: [{
            nome: 'Página Inicial GCS',
            funcao: `window.location.href='inicial.html'`
        }]
    },
    'Dashboard': {
        imagem: 'relatorio',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Ocorrências': {
        imagem: 'megafone',
        paineis: [{
            nome: 'Painel',
            funcao: ''
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
            nome: '',
            funcao: ''
        }]
    },
    'Materiais': {
        imagem: 'estoque',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Documentos': {
        imagem: 'duplicar',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Cadastros': {
        imagem: 'gerente',
        paineis: [{
            nome: 'Unidades de Manutenção',
            funcao: 'carregarUnidades()'
        },
        {
            nome: 'Sistemas',
            funcao: `carregarSistemas()`
        },
        {
            nome: 'Equipamentos',
            funcao: `carregarEquipamentos()`
        }]

    },
    'Configurações': {
        imagem: 'ajustar',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
}

botoesLaterais()

function botoesLaterais() {

    let painelLateral = document.querySelector('.painelLateral')

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

async function carregarSistemas() {

    removerMenus()
    await sincronizarDados('sistemas')

    const sistemas = await recuperarDados('sistemas')

    const linhas = Object.entries(sistemas)
        .map(([cod, sistema]) => `
        <tr>
            <td>${sistema.nome}</td>
            <td>
                <div style="${horizontal};">
                    <img onclick="editarSistema('${cod}')" src="imagens/pesquisar2.png" style="cursor: pointer; width: 1.5vw;">
                </div>
            </td>
        </tr>
        `).join('')

    let acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes">
                ${botao('Novo', 'editarSistema()')}
            </div>
            <div style="height: 60vh; overflow-y: auto;">
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
        </div>
    `

    painelCentral.innerHTML = acumulado
}

async function editarSistema(cod) {

    let sistema = {}

    if (cod) {
        const sistemas = await recuperarDados('sistemas')
        sistema = sistemas[cod]
    } else {
        cod = ID5digitos()
    }

    const acumulado = `
        <div style="padding: 2vw; background-color: #d2d2d2;">
            <div style="${horizontal}; gap: 5px;">
                <textarea id="sistema" style="padding: 5px; border-radius: 2px;">${sistema?.nome || ''}</textarea>
                ${botao('Salvar', `salvarSistema('${cod}')`, 'green')}
            </div>
            <hr style="width: 100%;">
            ${acesso.permissao == 'adm' ? botao('Excluir sistema', `excluirSistema('${cod}')`) : ''}
        </div>
    `

    popup(acumulado, 'Sistema', true)

}

async function salvarSistema(cod) {

    overlayAguarde()
    let sistemas = await recuperarDados('sistemas')
    let sistema = sistemas[cod] || {}
    const novoNome = document.getElementById('sistema')

    if (novoNome) {
        sistema.nome = novoNome.value
        await inserirDados(sistemas, 'sistemas')
        await enviar(`sistemas/${cod}`, sistema)
    }

    await carregarSistemas()
    removerOverlay()
}

async function excluirSistema(cod) {

    removerPopup()
    overlayAguarde()

    await deletarDB('sistemas', cod)
    await deletar(`sistemas/${cod}`)

    await carregarSistemas()

    removerOverlay()

}

async function gerenciarUnidades() {

    removerMenus()
    const dados_clientes = await recuperarDados('dados_composicoes')
    const equipamentos = await recuperarDados('equipamentos')

    function tabelasHTML(base, chave) {

        let linhas = ''

        if(!filtrosOcorrencias[chave]) filtrosOcorrencias[chave] = {}

        Object.entries(base).forEach(([codigo, composicao]) =>

            linhas += `
            <tr>
                <td>
                    <div style="${horizontal}; justify-content: space-between; width: 100%;">
                        <div style="${vertical};">
                            ${modelo('Descricao', composicao.descricao)}
                            ${modelo('Fabricante', composicao.fabricante)}
                            ${modelo('Modelo', composicao.modelo)}
                            ${modelo('Tipo', composicao.tipo)}
                        </div>
                        
                    </div>
                </td>
                <td style="text-align: center;">
                    <input name="${chave}" id="${codigo}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                </td>
            </tr>`
        )

        return `<table class="tabela" style="display: table-row;">
            <thead>
                <tr>
                    <th>
                        <div style="${horizontal}; gap: 2px;">
                            <label>Descrição</label>
                        </div>
                    </th>
                    <th>
                        <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this)">
                        <label>Todos</label>
                    </th>
                </tr>
                <tr>
                    <th style="background-color: white;">
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <input placeholder="Pesquise o Equipamento" oninput="pesquisar_generico(0, this.value, filtrosOcorrencias['${chave}'], 'body_${chave}')">
                            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                        </div>
                    </th>
                    <th style="background-color: white;"></th>
                </tr>
            </thead>
            <tbody id="body_${chave}">${linhas}</tbody>
        </table>`
    }

    let acumulado = `
        <div>
            <label style="font-size: 2.0vw; color: white;">Equipamentos Disponíveis - ${Object.keys(dados_composicoes).length}</label>
            <div class="painelBotoes">
                ${botao('Importar', `gerenciarEquipamentos('Composicoes')`)}
            </div>
            <div style="height: 70vh; overflow-y: auto;">
                ${tabelasHTML(dados_composicoes, 'Composições')}
            </div>
        </div>

        <img src="imagens/direita.png" style="width: 3vw; margin: 1vw;">

        <div>
            <label style="font-size: 2.0vw; color: white;">Equipamentos Ativas - ${Object.keys(equipamentos).length}</label>
            <div class="painelBotoes">
                ${botao('Remover', `gerenciarEquipamentos('Equipamentos')`)}
            </div>
            <div style="height: 70vh; overflow-y: auto;">
                ${tabelasHTML(equipamentos, 'Equipamentos')}
            </div>
        </div>
    `

    painelCentral.innerHTML = acumulado

}

async function gerenciarUnidades(base) {

    overlayAguarde()

    const dados_clientes = await recuperarDados('dados_clientes')
    let inputs = document.querySelectorAll(`[name="${base}"]`)

    let dados = {}

    for (let inputTab of inputs) {

        if (inputTab.checked) {

            const idCliente = inputTab.id

            if (base == 'Clientes') {
                dados[idCliente] = dados_clientes[idCliente]
            } else if (base == 'Unidades') {
                await deletarDB('unidades', idCliente)
            }

        }

    }

    if (base == 'Clientes') await inserirDados(dados, 'unidades')

    await carregarUnidades()

    removerOverlay()

}

function marcarTodosVisiveis(input) {

    let tabela = input.closest('table')

    let inputs = tabela.querySelectorAll('input')

    inputs.forEach(inputTab => {

        const marcar = inputTab.closest('tr').style.display !== 'none'
        if (marcar) inputTab.checked = input.checked

    })

}

async function carregarEquipamentos() {

    removerMenus()
    const dados_composicoes = await recuperarDados('dados_composicoes')
    const equipamentos = await recuperarDados('equipamentos')

    function tabelasHTML(base, chave) {

        let linhas = ''

        if(!filtrosOcorrencias[chave]) filtrosOcorrencias[chave] = {}

        Object.entries(base).forEach(([codigo, composicao]) =>

            linhas += `
            <tr>
                <td>
                    <div style="${horizontal}; justify-content: space-between; width: 100%;">
                        <div style="${vertical};">
                            ${modelo('Descricao', composicao.descricao)}
                            ${modelo('Fabricante', composicao.fabricante)}
                            ${modelo('Modelo', composicao.modelo)}
                            ${modelo('Tipo', composicao.tipo)}
                        </div>
                        
                    </div>
                </td>
                <td style="text-align: center;">
                    <input name="${chave}" id="${codigo}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                </td>
            </tr>`
        )

        return `<table class="tabela" style="display: table-row;">
            <thead>
                <tr>
                    <th>
                        <div style="${horizontal}; gap: 2px;">
                            <label>Descrição</label>
                        </div>
                    </th>
                    <th>
                        <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this)">
                        <label>Todos</label>
                    </th>
                </tr>
                <tr>
                    <th style="background-color: white;">
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <input placeholder="Pesquise o Equipamento" oninput="pesquisar_generico(0, this.value, filtrosOcorrencias['${chave}'], 'body_${chave}')">
                            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                        </div>
                    </th>
                    <th style="background-color: white;"></th>
                </tr>
            </thead>
            <tbody id="body_${chave}">${linhas}</tbody>
        </table>`
    }

    let acumulado = `
        <div>
            <label style="font-size: 2.0vw; color: white;">Equipamentos Disponíveis - ${Object.keys(dados_composicoes).length}</label>
            <div class="painelBotoes">
                ${botao('Importar', `gerenciarEquipamentos('Composicoes')`)}
            </div>
            <div style="height: 70vh; overflow-y: auto;">
                ${tabelasHTML(dados_composicoes, 'Composições')}
            </div>
        </div>

        <img src="imagens/direita.png" style="width: 3vw; margin: 1vw;">

        <div>
            <label style="font-size: 2.0vw; color: white;">Equipamentos Ativas - ${Object.keys(equipamentos).length}</label>
            <div class="painelBotoes">
                ${botao('Remover', `gerenciarEquipamentos('Equipamentos')`)}
            </div>
            <div style="height: 70vh; overflow-y: auto;">
                ${tabelasHTML(equipamentos, 'Equipamentos')}
            </div>
        </div>
    `

    painelCentral.innerHTML = acumulado

}

async function gerenciarEquipamentos(base) {

    overlayAguarde()

    const dados_composicoes = await recuperarDados('dados_composicoes')
    let inputs = document.querySelectorAll(`[name="${base}"]`)

    let dados = {}

    for (let inputTab of inputs) {

        if (inputTab.checked) {

            const codigo = inputTab.id

            if (base == 'Composicoes') {
                dados[codigo] = dados_composicoes[codigo]
            } else if (base == 'Equipamentos') {
                await deletarDB('equipamentos', codigo)
            }

        }

    }

    if (base == 'Composicoes') await inserirDados(dados, 'equipamentos')

    await carregarEquipamentos()

    removerOverlay()

}

async function carregarSistemas() {

    removerMenus()
    await sincronizarDados('sistemas')

    const sistemas = await recuperarDados('sistemas')

    const linhas = Object.entries(sistemas)
        .map(([cod, sistema]) => `
        <tr>
            <td>${sistema.nome}</td>
            <td>
                <div style="${horizontal};">
                    <img onclick="editarSistema('${cod}')" src="imagens/pesquisar2.png" style="cursor: pointer; width: 1.5vw;">
                </div>
            </td>
        </tr>
        `).join('')

    let acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes">
                ${botao('Novo', 'editarSistema()')}
            </div>
            <div style="height: 60vh; overflow-y: auto;">
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
        </div>
    `

    painelCentral.innerHTML = acumulado
}
