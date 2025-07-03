const modeloLabel = (valor1, elemento) => `
<div style="width: 100%; display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 5px;">
    <label>${valor1}</label>
    ${elemento}
</div>
`
let filtroVeiculos = {}
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

carregarTabela()

async function carregarTabela() {
    let motoristas = await recuperarDados('motoristas') || {}
    let veiculos = await recuperarDados('veiculos') || {}
    let botoesCarros = Object.entries(veiculos)
        .map(veiculo => `
            <div class="diVeiculos" onclick="novoVeiculo('${veiculo[0]}')">
                <label><strong>${veiculo[1].modelo}</strong></label>
                <label style="font-size: 0.8vw;">${veiculo[1].placa}</label>
                <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                    <img src="imagens/${veiculo[1].status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5vw;">
                    <label>${veiculo[1].status}</label>
                </div>
            </div>
            `)
        .join('')
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let ths = '', tsh = ''
    let colunas = ['Motorista', 'Veículo', 'Combustível', 'Pedágio', 'Multas', 'Custos Extras']
        .map((coluna, i) => {
            tsh += `
            <th style="background-color: white;">
                <div style="display: flex; align-items: center; justify-content: center;">
                    <input oninput="pesquisar_generico(${i}, this.value, filtroVeiculos, 'bodyVeiculos')" style="border: none;">
                    <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                </div>
            </th>
            `
            ths += `<th style="color: white;">${coluna}</th>`
        })

    let divModelo = (valor1, nome, idMotorista, categoria) => `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <label style="cursor: pointer;" onclick="abrirCustos('${categoria}', '${idMotorista}')">${dinheiro(valor1)}</label>
            <img onclick="painelValores('${nome}', '${idMotorista}', '${categoria}')" src="imagens/baixar.png" style="cursor: pointer; width: 1.5vw;">
        </div>
    `
    function somarValores(objeto) {
        let soma = 0

        for ([id, dados] of Object.entries(objeto)) {
            soma += dados.custo_total
        }

        return soma
    }

    let linhas = ''
    for (let [idMotorista, motorista] of Object.entries(motoristas)) {

        let nome = dados_clientes[idMotorista].nome
        let veiculo = veiculos[motorista.veiculo]

        linhas += `
        <tr>
            <td>
                <div style="display: flex; justify-content: start; align-items: center; gap: 10px;">
                    <img onclick="novoMotorista('${idMotorista}')" src="imagens/construcao.png" style="cursor: pointer; width: 1.5vw;">
                    <label>${nome}</label>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: start; justify-content: start; flex-direction: column;">
                    <label>${veiculo.placa}</label>
                    <label>${veiculo.modelo}</label>
                    <label>${veiculo.status}</label>
                </div>
            </td>
            <td>${divModelo(somarValores(motorista?.combustivel || {}), nome, idMotorista, 'Combustível')}</td>
            <td>${divModelo(somarValores(motorista?.pedagio || {}), nome, idMotorista, 'Pedágio')}</td>
            <td>${divModelo(somarValores(motorista?.multas || {}), nome, idMotorista, 'Multas')}</td>
            <td>${divModelo(somarValores(motorista?.extras || {}), nome, idMotorista, 'Custos Extras')}</td>
        </tr>
        `
    }

    let acumulado = `

    <div style="border-radius: 2px; background-color: #d2d2d2; display: flex; justify-content: center; align-items: start; gap: 10px;">

        <div style="width: 10vw;">
            ${botaoVeiculos('Novo Motorista', 'novoMotorista()')}
            <hr style="width: 100%;">
            ${botaoVeiculos('Novo Veículo', 'novoVeiculo()')}
            ${botoesCarros}
        </div>
    
        <table class="tabela" style="width: 100%;">
            <thead style="background-color: #797979;">
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="bodyVeiculos">
                ${linhas}
            </tbody>
        </table>

    </div>
    `
    document.getElementById('tabelaRegistro').innerHTML = acumulado
}


async function abrirCustos(categoria, idMotorista) {

    let motoristas = await recuperarDados('motoristas') || {}

    let motorista = motoristas[idMotorista]

    let categoriaReal = categorias[categoria]

    let valores = motorista?.[categoriaReal] || {}
    let linhas = ''

    let ths = ['Data', 'Usuário', 'Comentário', 'Valores', 'Excluir']
        .map(coluna => `<th style="color: white;">${coluna}</th>`)
        .join('')

    for (let [id, dados] of Object.entries(valores)) {
        linhas += `
            <tr>
                <td>${dados.data}</td>
                <td>${dados.usuario}</td>
                <td style="text-align: left;">${dados.comentario}</td>
                <td>${dinheiro(dados.custo_total)}</td>
                <td><img onclick="excluirValor('${categoria}', '${id}', '${idMotorista}')" src="imagens/cancel.png" style="cursor: pointer; width: 1.5vw;"></td> 
            </tr>
        `
    }

    let acumulado = `
        <div class="paineis">
            
            <table class="tabela" style="width: 100%;">
                <thead style="background-color: #797979;">
                    ${ths}
                </thead>
                <tbody>${linhas}</tbody>
            </table>

        </div>
    `
    popup(acumulado, categoria)
}

async function excluirValor(categoria, idValor, idMotorista) {

    overlayAguarde()
    let motoristas = await recuperarDados('motoristas') || {}

    let categoriaReal = categorias[categoria]
    delete motoristas[idMotorista][categoriaReal][idValor]

    await inserirDados(motoristas, 'motoristas')

    await carregarTabela()
    await abrirCustos(categoria, idMotorista)

}

async function painelValores(nome, idMotorista, categoria) {

    let campos = ''

    if (categoria == 'Combustível') {
        campos += `
            ${modeloLabel('KM', `<input type="number" id="km" placeholder="Quilometragem" type="number">`)}
            ${modeloLabel('Litros', `<input type="number" id="litros" placeholder="Quantidade de litros" type="number">`)}
            ${modeloLabel('Custo/Litro', `<input type="number" id="custo_litro" placeholder="Custo por litro" type="number">`)}
        `
    }

    campos += `
        ${modeloLabel('Custo Total', `<input type="number" id="custo_total" placeholder="Total do lançamento" type="number">`)}
        ${modeloLabel('Comentário', `<textarea id="comentario"></textarea>`)}
    `

    let acumulado = `
        <div class="paineis">
            <label>${nome}</label>
            <hr style="width: 100%;">
            ${campos}
            <hr style="width: 100%;">
            ${botaoVeiculos('Incluir', `salvarValores('${idMotorista}', '${categoria}')`, 'green')}
        </div>
    `
    popup(acumulado, categoria)
}

async function salvarValores(idMotorista, categoria) {

    overlayAguarde()
    let motoristas = await recuperarDados('motoristas') || {}

    let categoriaReal = categorias[categoria]
    let motorista = motoristas[idMotorista]
    let idCusto = ID5digitos()
    if (!motorista[categoriaReal]) motorista[categoriaReal] = {}

    let dados = {
        custo_total: obterValores('custo_total'),
        comentario: obterValores('comentario'),
        data: data_atual('completa'),
        usuario: acesso.usuario
    }

    if (categoria == 'Combustível') {
        dados.km = obterValores('km')
        dados.litros = obterValores('litros')
        dados.custo_litro = obterValores('custo_litro')
    }

    motorista[categoriaReal][idCusto] = dados

    await inserirDados(motoristas, 'motoristas')

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
    idVeiculo ? idVeiculo : ID5digitos()
    let veiculo = {
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        status: obterValores('status')
    }

    veiculos[idVeiculo] = veiculo

    await inserirDados(veiculos, 'veiculos')
    await carregarTabela()

    removerPopup()
    removerOverlay()
}

async function dadosVeiculo() {
    let veiculos = await recuperarDados('veiculos') || {}
    let idVeiculo = obterValores('veiculo')
    let veiculo = veiculos[idVeiculo]

    let div = document.getElementById('dados_veiculos')

    div.innerHTML = `
    <div style="display: flex; justify-content: start; align-items: start; flex-direction: column; gap: 5px;">
        ${labelDestaque('Modelo', veiculo.modelo)}
        ${labelDestaque('Placa', veiculo.placa)}
        ${labelDestaque('Status', veiculo.status)}
    </div>
    `
}

async function novoMotorista(idMotorista) {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let motoristas = await recuperarDados('motoristas') || {}
    let veiculos = await recuperarDados('veiculos') || {}
    let idVeiculo = motoristas?.[idMotorista]?.veiculo || ''
    let modeloVeiculo = veiculos?.[idVeiculo]?.modelo || ''

    let opcoes = Object.entries(veiculos)
        .map(veiculo => `<option value="${veiculo[0]}" ${veiculo[1].modelo == modeloVeiculo ? 'selected' : ''}>${veiculo[1].modelo}</option>`)
        .join('')

    let acumulado = `
        <div class="paineis">
            ${modeloLabel('Motorista', `
            <textarea id="motorista" oninput="carregarClientes(this)">${dados_clientes?.[idMotorista]?.nome || idMotorista || ''}</textarea> 
            <input id="omie" value="${idMotorista || ''}" style="display: none;">
            `)}

            ${modeloLabel('Selecione o veículo', `
                <select id="veiculo" onchange="dadosVeiculo()">
                    ${opcoes}
                </select>
                `)}

            <div id="dados_veiculos"></div>

            <hr style="width: 100%;">
            ${botaoVeiculos('Salvar', 'salvarMotorista()', 'green')}
        </div>
    `
    popup(acumulado, 'Novo Motorista')

    await dadosVeiculo()
}

async function salvarMotorista() {

    overlayAguarde()
    let motoristas = await recuperarDados('motoristas') || {}
    let idMotorista = obterValores('omie')
    let motorista = {
        veiculo: obterValores('veiculo')
    }

    motoristas[idMotorista] = motorista

    await inserirDados(motoristas, 'motoristas')

    await carregarTabela()
    removerPopup()
    removerOverlay()
}