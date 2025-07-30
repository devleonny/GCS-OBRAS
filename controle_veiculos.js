const modeloLabel = (valor1, elemento) => `
<div style="width: 100%; display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 5px;">
    <label>${valor1}</label>
    ${elemento}
</div>
`
let filtroVeiculos = {}
const labelDupla = (valor1, valor2) => `
    <div style="display: flex; flex-direction: column; align-items: start;">
        <label style="font-size: 0.7vw;"><strong>${valor1}</strong></label>
        <label style="font-size: 0.9vw;">${valor2}</label>
    </div>
`
const botaoVeiculos = (valor1, funcao, cor) => `
    <div class="botoes" style="background-color: ${cor};" onclick="${funcao}">
        <label>${valor1}</label>
    </div>
`
const categorias = {
    'Combustível': 'combustivel',
    'Pedágio': 'pedagio',
    'Multas': 'multas',
    'Custos Extras': 'extras'
}

async function atualizarDadosVeiculos() {
    await sincronizarDados('motoristas')
    await sincronizarDados('dados_clientes')
    await sincronizarDados('veiculos')
    await sincronizarDados('custo_veiculos')

    await carregarTabela()
}

carregarTabela()

async function carregarTabela() {

    let veiculos = await recuperarDados('veiculos') || {}
    let motoristas = await recuperarDados('motoristas') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let custo_veiculos = await recuperarDados('custo_veiculos') || {}

    let botoesMotoristas = Object.entries(motoristas)
        .map(([idMotorista, motorista]) =>
            `<div class="diVeiculos" onclick="novoMotorista('${idMotorista}')">
                <img src="imagens/${veiculos?.[motorista.veiculo]?.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5vw;">

                <div style="${vertical}">
                    <label name="motorista">${String(dados_clientes?.[idMotorista]?.nome || '').slice(0, 10)}...</label>
                    <label><strong>${veiculos?.[motorista.veiculo]?.modelo || ''}</strong> ${veiculos?.[motorista.veiculo]?.placa || 'Sem veículo'}</label>
                </div>
            </div>
            `)
        .join('')

    let botoesCarros = Object.entries(veiculos)
        .map(([idVeiculo, veiculo]) => `
            <div class="diVeiculos" onclick="novoVeiculo('${idVeiculo}')">
                <img src="imagens/${veiculo.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5vw;">

                <div style="${vertical}">
                    <label name="veículo"><strong>${veiculo.modelo}</strong></label>
                    <label name="veículo" style="font-size: 0.8vw;">${veiculo.placa}</label>
                    <label name="veículo">${veiculo.status}</label>
                </div>
            </div>
            `)
        .join('')

    function conversorData(data) {

        if (!data) return ''

        let [ano, mes, dia] = data.split('-')
        let dataFormatada = `${dia}/${mes}/${ano}`

        return dataFormatada
    }

    let ths = '', tsh = ''
    let colunas = ['Usuário & Data', 'Veículo', 'Tipo', 'Valor & Data Pagamento', 'Cartão', 'Comentário', 'Anexos', 'Editar']
        .map((coluna, i) => {
            tsh += (coluna == 'Editar' || coluna == 'Anexos') ? '<th style="background-color: white;"></th>' : `
            <th style="background-color: white;">
                <div style="display: flex; align-items: center; justify-content: center;">
                    <input oninput="pesquisar_generico(${i}, this.value, filtroVeiculos, 'bodyVeiculos')" style="border: none;">
                    <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                </div>
            </th>
            `
            ths += `<th>${coluna}</th>`
        })

    let linhas = ''

    custo_veiculos = Object.fromEntries(
        Object.entries(custo_veiculos).sort((a, b) => {
            return new Date(b[1].data_pagamento) - new Date(a[1].data_pagamento);
        })
    );

    for (let [idCusto, custo] of Object.entries(custo_veiculos)) {

        let anexos = Object.entries(custo?.anexos || {})
            .map(([idAnexo, anexo]) => `
                ${criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo('${idCusto}', '${idAnexo}', this)`)}
                `)
            .join('')
        let nome = dados_clientes[custo.motorista].nome
        let veiculo = veiculos[custo.veiculo]

        linhas += `
        <tr>
            <td>
                <div style="display: flex; flex-direction: column; align-items: start;">
                    <label><strong>${custo.usuario}</strong></label>
                    <label>${custo.data}</label>
                </div>
            </td>

            <td>
                <div style="display: flex; align-items: start; justify-content: center; flex-direction: column;">
                    <label title="${nome}">${nome.slice(0, 20)}...</label>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                        <label style="font-size: 0.7vw;">${veiculo.placa}</label>

                        <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                            <img src="imagens/${veiculo.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1vw;">
                            <label style="font-size: 0.7vw;">${veiculo.status}</label>
                        </div>
                    </div>
                </div>
            </td>
            <td>${custo.categoria}</td>

            <td>
                <div style="display: flex; align-items: start; justify-content: start; flex-direction: column;">
                    <label><strong>${dinheiro(custo.custo_total)}</strong></label>
                    <label style="font-size: 0.7vw;">${conversorData(custo.data_pagamento)}</label>
                </div>
            </td>

            <td>${veiculo?.cartao || 'Não informado'}</td>
            <td style="text-align: left;">${custo.comentario}</td>

            <td>
                <div style="display: flex; align-items: center;">
                    <img onclick="document.getElementById('${idCusto}').click()" src="imagens/baixar.png" style="cursor: pointer; width: 1.5vw;">
                    <input id="${idCusto}" type="file" style="display: none;" onchange="salvarAnexoCusto(this)" multiple>
                    <div style="display: flex; flex-direction: column;">
                        ${anexos}
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <img src="imagens/pesquisar2.png" style="width: 1.5vw; cursor: pointer;" onclick="painelAtalhos('${idCusto}')">
                </div>
            </td>
        </tr>
        `
    }

    const pesquisa = (modalidade) => `
    <div style="${horizontal}; background-color: white; border-radius: 15px; margin-left: 5px;  margin-right: 5px;">
        <input style="border: none; border-radius: 15px;" oninput="pesquisarBotoes(this, '${modalidade}')" placeholder="Pesquisar ${modalidade}">
        <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
    </div>
    `

    let acumulado = `

    <div style="padding: 1vw; border-radius: 2px; background-color: #00000038; display: flex; justify-content: center; align-items: start; gap: 10px;">

        <div style="${horizontal}; align-items: start; width: 40vw; border-right: dashed 1px #797979; padding-right: 1vw; gap: 10px;">

            <div style="${vertical};">
                <div class="painelBotoes" style="${vertical}; padding-bottom: 3px;">
                    ${botaoVeiculos('Novo Motorista', 'novoMotorista()', '#04549a')}
                    ${pesquisa('motorista')}
                </div>
                <div id="motorista" class="fundoPainelLateral">${botoesMotoristas}</div>
                <div class="rodapeTabela"></div>
            </div>

            <div style="${vertical};">
                <div class="painelBotoes" style="${vertical}; padding-bottom: 3px;">
                    ${botaoVeiculos('Novo Veículo', 'novoVeiculo()', '#04549a')}
                    ${pesquisa('veículo')}
                </div>
                <div id="veículo" class="fundoPainelLateral">${botoesCarros}</div>
                <div class="rodapeTabela"></div>
            </div>

        </div>

        <div style="${vertical}; margin-top: 1vw;">
            <div class="painelBotoes" style="height: 5vh;"></div>
            <div style="height: max-content; max-height: 50vh; overflow-y: auto;">
                <table class="tabela" style="display: table-row;">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${tsh}</tr>
                    </thead>
                    <tbody id="bodyVeiculos">
                        ${linhas}
                    </tbody>
                </table>
            </div>
        </div>

    </div>
    `
    document.getElementById('tabelaRegistro').innerHTML = acumulado
}


async function painelAtalhos(idCusto) {

    const custo = await recuperarDado('custo_veiculos', idCusto)

    const acumulado = `
    <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw;">
        ${modeloBotoes('duplicar', 'Duplicar Pagamento', `painelValores('${idCusto}', true)`)}
        ${modeloBotoes('editar', 'Editar Pagamento', `painelValores('${idCusto}')`)}
        ${(acesso.permissao == 'adm' || acesso.usuario == custo.usuario) ? modeloBotoes('excluir', 'Excluir Pagamento', `painelExcluir('${idCusto}')`) : ''}
    </div>
    `
    popup(acumulado, 'ATALHOS')
}

function pesquisarBotoes(input, modalidade) {
    const container = document.getElementById(modalidade);
    const termo = input.value.toLowerCase();
    const divs = container.querySelectorAll('div');

    for (let div of divs) {
        const labels = div.querySelectorAll(`[name="${modalidade}"]`);
        let tdsTermos = '';

        for (let label of labels) {
            tdsTermos += ' ' + label.textContent.toLowerCase();
        }

        const visivel = tdsTermos.includes(termo) || termo === '';
        div.style.display = visivel ? 'flex' : 'none';
    }
}

function painelExcluir(idCusto) {

    let acumulado = `
    <div style="display: flex; align-items: center; gap: 2vw; justify-content: center; padding: 2vw; background-color: #d2d2d2;">

        <label>Deseja excluir este lançamento?</label>
        
        ${botao('Confirmar', `excluirCusto('${idCusto}')`, `green`)}
    
    </div>
    `

    popup(acumulado, 'Tem certeza?')
}

async function excluirCusto(idCusto) {

    removerPopup()
    overlayAguarde()
    await deletarDB('custo_veiculos', idCusto)
    await deletar(`custo_veiculos/${idCusto}`)
    await carregarTabela()
    removerOverlay()

}

async function painelValores(idCusto, duplicar) {

    await sincronizarDados('veiculos')
    await sincronizarDados('motoristas')

    let custo_veiculos = await recuperarDados('custo_veiculos') || {}
    let motoristas = await recuperarDados('motoristas') || {};
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let custo = custo_veiculos[idCusto];

    let opcoesMotoristas = Object.entries(motoristas)
        .sort((a, b) => {
            const nomeA = (dados_clientes[a[0]]?.nome || '').toLowerCase();
            const nomeB = (dados_clientes[b[0]]?.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        })
        .map(([idMotorista, motorista]) =>
            `<option data-id="${idMotorista}" value="${custo?.veiculo || motorista?.veiculo || ''}" ${custo?.motorista == idMotorista ? 'selected' : ''}>
            ${dados_clientes[idMotorista]?.nome || 'Sem nome'}
        </option>`)
        .join('');

    let categorias = ['Combustível']
        .map(categoria => `<option ${custo?.categoria == categoria ? 'selected' : ''}>${categoria}</option>`)
        .join('')

    let campos = `
            <div style="${horizontal}; gap: 10px; width: 100%;">
                ${modeloLabel('Data do Pagamento', `<input id="data_pagamento" type="date" value="${custo?.data_pagamento || ''}">`)}
                ${modeloLabel('Categoria', `
                    <select id="categoria">
                        ${categorias}
                    </select>
                    `)}
            </div>
            <div style="${horizontal}; gap: 10px;">
                <div style="${vertical};">
                    ${modeloLabel('KM', `<input oninput="calcularValorCombustivel()" value="${custo?.km || ''}" type="number" id="km" type="number">`)}
                    ${modeloLabel('Litros', `<input oninput="calcularValorCombustivel(true)" value="${custo?.litros || ''}" type="number" id="litros" type="number">`)}
                </div>
                <div style="${vertical};">
                    ${modeloLabel('KM/L', `<input oninput="calcularValorCombustivel()" value="${custo?.kml || ''}" type="number" id="kml" type="number">`)}
                    ${modeloLabel('Valor Combustível', `<input oninput="calcularValorCombustivel()" value="${custo?.combustivel || ''}" type="number" id="combustivel" type="number">`)}
                </div>
            </div>
            
            <div style="${horizontal}; gap: 10px;">
                ${modeloLabel('Custo Total', `<input value="${custo?.custo_total || ''}" type="number" id="custo_total" type="number">`)}
                ${modeloLabel('Comentário', `<textarea id="comentario">${custo?.comentario || ''}</textarea>`)}
            </div>
            <div id="dados_veiculos" class="contornoDestaque"></div>
            ${modeloLabel('Motorista', `
                <select id="veiculo" onchange="dadosVeiculo()">
                    ${opcoesMotoristas}
                </select>
                `)}
            
    `
    let funcao = !idCusto ? `salvarValores()` : duplicar ? `salvarValores(false)` : `salvarValores('${idCusto}')`

    let acumulado = `
        <div class="paineis">
            ${campos}
            <hr style="width: 100%;">
            ${botaoVeiculos('Adicionar', funcao, 'green')}
        </div>
    `
    popup(acumulado, 'Adicionar Custo')

    await dadosVeiculo()
}

function calcularValorCombustivel(valorManual) {
    const km = obterValores('km')
    const kml = obterValores('kml')
    const litros = valorManual ? obterValores('litros') : Math.ceil(km / kml)
    const combustivel = obterValores('combustivel')

    const resultado = litros * combustivel
    const proximoMultiploDe10 = Math.ceil(resultado / 10) * 10

    if(!valorManual) document.getElementById('litros').value = litros
    document.getElementById('custo_total').value = proximoMultiploDe10
}

async function salvarValores(idCusto) {

    overlayAguarde()
    let custo_veiculos = await recuperarDados('custo_veiculos') || {}
    let select = document.getElementById('veiculo')
    let idMotorista = select.options[select.selectedIndex].dataset.id
    let categoria = obterValores('categoria')
    idCusto = idCusto || ID5digitos()

    if (select.value == '') return popup(mensagem('O condutor está sem veículo'), 'ALERTA', true)

    if (!custo_veiculos[idCusto]) custo_veiculos[idCusto] = {}

    const custo_total = obterValores('custo_total')
    const data_pagamento = obterValores('data_pagamento')

    if (custo_total == '') return popup(mensagem(`Preencha o valor do pagamento`), 'ALERTA', true)
    if (data_pagamento == '') return popup(mensagem(`Preencha a data de pagamento`), 'ALERTA', true)

    let dados = {
        motorista: idMotorista,
        veiculo: select.value,
        categoria,
        custo_total,
        combustivel: obterValores('combustivel'),
        kml: obterValores('kml'),
        comentario: obterValores('comentario'),
        data_pagamento,
        data: data_atual('completa'),
        usuario: acesso.usuario
    }

    if (categoria == 'Combustível') {
        dados.km = obterValores('km')
        dados.litros = obterValores('litros')
    }

    custo_veiculos[idCusto] = {
        ...custo_veiculos[idCusto],
        ...dados
    }

    enviar(`custo_veiculos/${idCusto}`, custo_veiculos[idCusto])
    await inserirDados(custo_veiculos, 'custo_veiculos')
    await carregarTabela()

    removerPopup()
}

async function novoVeiculo(idVeiculo) {

    let veiculos = await recuperarDados('veiculos') || {}
    let veiculo = veiculos[idVeiculo]
    let opcoes = ['Locado', 'Devolvido']
        .map(op => `<option ${veiculo?.status == op ? 'selected' : ''}>${op}</opcoes>`)
        .join('')
    let funcao = idVeiculo ? `salvarVeiculo('${idVeiculo}')` : 'salvarVeiculo()'

    let acumulado = `
    <div class="paineis">
        ${modeloLabel('Placa', `<input value="${veiculo?.placa || ''}" id="placa" placeholder="Placa">`)}
        ${modeloLabel('Modelo', `<input value="${veiculo?.modelo || ''}" id="modelo" placeholder="Modelo">`)}
        ${modeloLabel('Final do Cartão', `<input value="${veiculo?.cartao || ''}" id="cartao" placeholder="Final do Cartão abastecimento">`)}
        ${modeloLabel('Status', `
            <select id="status">
                ${opcoes}
            </select>
            `)}
        <hr style="width: 100%;">
        ${botaoVeiculos('Salvar', funcao, 'green')}
    </div>
`
    popup(acumulado, 'Novo Veículo')
}

function obterValores(id) {
    const elemento = document.getElementById(id);
    const tipo = elemento.type;

    if (tipo === "number") return Number(elemento.value);

    return elemento.value;
}

async function salvarVeiculo(idVeiculo) {

    overlayAguarde()
    let veiculos = await recuperarDados('veiculos') || {}
    idVeiculo = idVeiculo || ID5digitos()
    let veiculo = {
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        status: obterValores('status'),
        cartao: obterValores('cartao')
    }

    veiculos[idVeiculo] = veiculo

    enviar(`veiculos/${idVeiculo}`, veiculo)
    await inserirDados(veiculos, 'veiculos')
    await carregarTabela()

    removerPopup()
    removerOverlay()
}

async function dadosVeiculo(input) {

    let veiculos = await recuperarDados('veiculos') || {}
    let select = document.getElementById('veiculo')
    let idVeiculo = select.value
    let veiculo = veiculos[idVeiculo]
    let acumulado = `<label>Sem Veículo</label>`

    if (veiculo) {
        acumulado = `
        <div style="display: flex; justify-content: space-evenly; align-items: center; width: 100%;">
            <img src="imagens/veiculo.png" style="width: 5vw;">
            <div style="display: flex; justify-content: start; align-items: start; flex-direction: column;">
                ${labelDupla('Final do Cartão', veiculo?.cartao || 'Não informado')}
                ${labelDupla('Modelo', veiculo.modelo)}
                ${labelDupla('Placa', veiculo.placa)}
                ${labelDupla('Status', veiculo.status)}
            </div>
        </div>    
    `}

    let div = document.getElementById('dados_veiculos')

    if (input && input.checked) {
        select.style.display = 'none'
        select.previousElementSibling.style.display = 'none'
        div.innerHTML = ''
        return
    }

    select.style.display = ''
    select.previousElementSibling.style.display = ''

    div.innerHTML = acumulado
}

async function novoMotorista(idMotorista) {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let motoristas = await recuperarDados('motoristas') || {}
    let veiculos = await recuperarDados('veiculos') || {}
    let idVeiculo = motoristas?.[idMotorista]?.veiculo || ''
    let modeloVeiculo = veiculos?.[idVeiculo]?.modelo || ''

    let opcoes = Object.entries(veiculos)
        .map(([idVeiculo, veiculo]) => `<option value="${idVeiculo}" ${veiculo.modelo == modeloVeiculo ? 'selected' : ''}>${veiculo.modelo} ${veiculo.placa}</option>`)
        .join('')

    let acumulado = `
        <div class="paineis">

            ${modeloLabel('Motorista', `
            <textarea id="omieMotorista" oninput="carregarClientes(this)">${dados_clientes?.[idMotorista]?.nome || idMotorista || ''}</textarea> 
            <input id="omie" value="${idMotorista || ''}" style="display: none;">
            `)}

            <div class="contornoDestaque">
                <input style="width: 1.5vw; height: 1.5vw;" type="checkbox" onchange="dadosVeiculo(this)">
                <label>Sem veículo no momento</label>
            </div>
            
            <div id="dados_veiculos" class="contornoDestaque"></div>
            ${modeloLabel('Selecione o veículo', `
                <select id="veiculo" onchange="dadosVeiculo()">
                    ${opcoes}
                </select>
                `)}

            <hr style="width: 100%;">
            ${botaoVeiculos('Salvar', 'salvarMotorista()', 'green')}
        <div>
   
    `
    popup(acumulado, 'Novo Motorista')

    await dadosVeiculo()
}

async function salvarMotorista() {

    overlayAguarde()
    let motoristas = await recuperarDados('motoristas') || {}
    let idMotorista = obterValores('omie')

    if (idMotorista == '') return popup(mensagem('Escolha um motorista'), 'AVISO', true)

    let motorista = {}
    let veiculo = document.getElementById('veiculo')

    if (veiculo.style.display !== 'none') {
        motorista.veiculo = veiculo.value
    }

    motoristas[idMotorista] = motorista

    enviar(`motoristas/${idMotorista}`, motorista)
    await inserirDados(motoristas, 'motoristas')

    await carregarTabela()
    removerPopup()
    removerOverlay()
}

async function removerAnexo(idCusto, idAnexo, img) {

    let custo_veiculos = await recuperarDados('custo_veiculos')
    let custo = custo_veiculos[idCusto]

    delete custo.anexos[idAnexo]

    deletar(`custo_veiculos/${idCusto}/anexos/${idAnexo}`)
    await inserirDados(custo_veiculos, 'custo_veiculos')

    img.parentElement.remove()
}

async function salvarAnexoCusto(input) {

    let dadosAnexos = await importarAnexos(input)
    let custo_veiculos = await recuperarDados('custo_veiculos')
    let idCusto = input.id
    let custo = custo_veiculos[idCusto]

    if (!custo.anexos) custo.anexos = {}

    dadosAnexos.forEach(anexo => {
        let idAnexo = ID5digitos()
        custo.anexos[idAnexo] = anexo
        input.nextElementSibling.insertAdjacentHTML('afterend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo('${idCusto}', '${idAnexo}', this)`))
        enviar(`custo_veiculos/${idCusto}/anexos/${idAnexo}`, anexo)
    })

    await inserirDados(custo_veiculos, 'custo_veiculos')

}