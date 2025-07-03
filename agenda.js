let filtro_tecnicos = {}
let filtroPagamentos = {}
let dados_departamentos = {}
let dados_agenda_tecnicos = {}
let dados_categorias = {}
let categoriasChaves = {}
let auxPagamFuncionario = {}
const mensagemHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>Verifique o campo <strong>${termo}</strong></label>
    </div>
    `

let semana = {
    "0": "Dom",
    "1": "Seg",
    "2": "Ter",
    "3": "Qua",
    "4": "Qui",
    "5": "Sex",
    "6": "Sáb"
}

let meses = {
    'Janeiro': 0,
    'Fevereiro': 1,
    'Março': 2,
    'Abril': 3,
    'Maio': 4,
    'Junho': 5,
    'Julho': 6,
    'Agosto': 7,
    'Setembro': 8,
    'Outubro': 9,
    'Novembro': 10,
    'Dezembro': 11
}

let regioes = ['Nordeste', 'Norte', 'Sudeste', 'Sul', 'Centro-Oeste', 'Sem Região', 'Clientes Novos', 'Administrativo']

iniciar_agendas()

async function iniciar_agendas(alterar) {
    await carregar_tabela(alterar)
}

async function sincronizar_departamentos() {

    overlayAguarde()

    await sincronizar('departamentos')
    let departamentosNuvem = await receber('dados_departamentos')
    dados_departamentos = departamentosNuvem
    await inserirDados(departamentosNuvem, 'dados_departamentos')
    await inserirDados(await receber('dados_categorias'), 'dados_categorias')

    removerPopup()
}

async function recuperar_agenda() {
    await sincronizarDados('dados_clientes')
    await sincronizarDados('dados_agenda_tecnicos')
    await carregar_tabela()
}

async function carregar_tabela(alterar) {

    overlayAguarde()

    await carregarBases()

    // Salvar quando alterado os dois Selects;
    if (alterar) {
        let mes = document.getElementById('mes')
        let ano = document.getElementById('ano')
        let periodoAtual = {
            mes: mes.value,
            ano: ano.value
        }
        localStorage.setItem('periodoAtual', JSON.stringify(periodoAtual))
    }
    // Salvar quando alterado os dois Selects;

    let dataAtual = new Date()
    let mesesIndiceMes = Object.entries(meses)
    periodoAtual = JSON.parse(localStorage.getItem('periodoAtual')) || { mes: mesesIndiceMes[dataAtual.getMonth()][0], ano: dataAtual.getFullYear() }

    let selectAno = periodoAtual.ano
    let selecMes = periodoAtual.mes
    let stringMeses = ''

    for (mes in meses) {
        stringMeses += `
            <option ${mes === selecMes ? 'selected' : ''}>${mes}</option>
        `
    }

    let linhas = ''
    let dias = new Date(selectAno, meses[selecMes] + 1, 0).getDate()
    let ths = `
        <th style="color: white;"></th>
        <th style="color: white;">Técnicos</th>
        <th style="color: white;">Região</th>
        <th style="color: white;">Config</th>
    `
    for (let i = 1; i <= dias; i++) { // Cabeçalho dias/Semanas do mês
        let data = new Date(selectAno, meses[selecMes], i)

        ths += `
        <th>
            <div style="color: white; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <label>${i}</label>
                <label>${semana[data.getDay()]}</label>
            </div>
        </th>
        `
    }

    for ([omieFuncionario, funcionario] of Object.entries(dados_agenda_tecnicos)) {

        let celulas_dias = ''
        let agenda = {}
        let periodo = `${selectAno}_${meses[selecMes]}`

        if (funcionario.agendas && funcionario.agendas[periodo]) {
            agenda = funcionario.agendas[periodo]
        }

        for (let i = 1; i <= dias; i++) { // tds, células da agenda de cada técnico;
            let cod_departamento = agenda?.[i]?.departamento || ''
            let info = dados_departamentos?.[cod_departamento]?.descricao || cod_departamento

            celulas_dias += `
                <td id="${cod_departamento}" style="cursor: move; position: relative;">
                    <div style="display: ${info != '' ? 'block' : 'none'}" class="com-triangulo" onclick="apagar_dia('${i}_${omieFuncionario}', this)"></div>
                    <input id="${i}_${omieFuncionario}" style="cursor: default; width: 3vw; background-color: transparent;" onmouseout="nome_em_destaque(this, false)" onmouseover="nome_em_destaque(this, true)" oninput="sugestoes(this)" value="${info}">
                    <label style="display: none;">${agenda?.[i]?.usuario || ''}</label>
                    <label style="display: none;">${agenda?.[i]?.data || ''}</label>
                </td>
            `
        }

        // Coluna 1: Nome do técnico;
        // Coluna 2: Região;
        // Coluna 3: Cofig;

        let regiao = dados_agenda_tecnicos[omieFuncionario]?.regiao_atual || 'Sem Região'

        if (acesso.permissao !== 'adm' && regiao == 'Administrativo') continue

        linhas += `
        <tr>
            <td class="drag-handle">☰</td>
            <td id="${omieFuncionario}" style="text-align: left;">${funcionario.nome || omieFuncionario}</td>
            <td>
                <label style="font-size: 0.7vw;">${regiao}</label>
            </td>
            <td style="text-align: center;">
                <img src="imagens/construcao.png" style="width: 2vw; cursor: pointer;" onclick="abrirDetalhes('${omieFuncionario}')">
            </td>
            ${celulas_dias}
        </tr>
        `
    }

    let string_regioes = ''
    regioes.forEach(regiao => {
        string_regioes += `
        <div style="display: flex; align-items: center; justify-content: end; gap: 2px;">
            <label style="font-size: 0.8vw;">${regiao}</label>
            <input style="width: 2vw; height: 2vw; cursor: pointer;" type="checkbox" onchange="incluir_regiao(this)">
        </div>
        `
    })

    let tabela = `
        <div class="fundo_tabela" id="dados_agenda">
            <table id="tabelaAgenda" class="tabela" style="table-layout: fixed;">
                <thead style="background-color: #797979;">
                    ${ths}
                </thead>
                <tbody id="bodyAgenda">
                    ${linhas}
                </tbody>
            </table>
        </div>
    `

    let modeloBotao = (valor1, link) => `
        <div onclick="${link}">
          <label style="text-align: right; font-size: 1.0vw;">${valor1}</label>
        </div>
    `

    let acumulado = `
    <div class="fundo">

        <div style="display: flex; flex-direction: column; align-items: end; justify-content: center; gap: 1vw; width: 10vw;">

            <div class="linksAgenda">

                ${modeloBotao('Sinc. Departamentos', 'sincronizar_departamentos()')}

                ${modeloBotao('Dist. Funcionários', 'distribuicaoFuncionario()')}

                ${modeloBotao('Novo Funcionário', `abrir_opcoes()`)}

            </div>

            <hr style="width: 100%;">

            <label>Mês</label>
            <select id="mes" onchange="iniciar_agendas(true)">
                ${stringMeses}
            </select>

            <hr style="width: 100%;">

            <label>Ano</label>
            <select id="ano" onchange="iniciar_agendas(true)">
                <option ${selectAno == 2024 ? 'selected' : ''}>2024</option>
                <option ${selectAno == 2025 ? 'selected' : ''}>2025</option>
                <option ${selectAno == 2026 ? 'selected' : ''}>2026</option>
            </select>

            <hr style="width: 100%;">

            <label>Nome</label>
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 2px;">
                <input class="campos" oninput="filtrar_por_regiao()" id="campo_tecnico_pesquisa" placeholder="Pesquisar">
            </div>

            <hr style="width: 100%;">
            <label>Regiões</label>
            <div id="filtros_regioes">
                ${string_regioes}
            </div>
        </div>

        ${tabela}

    </div>
    `

    let dados_agenda = document.getElementById('dados_agenda')
    if (dados_agenda) {
        dados_agenda.innerHTML = tabela
    } else {
        document.body.insertAdjacentHTML('beforeend', acumulado)
    }

    arrastarCelulas()

    colorir_tabela()

    removerPopup()

    filtrar_por_regiao()
    filtrar_tabela('0', 'tabelaAgenda') // Script genérico que organiza a tabela com base na coluna e no ID da tabela.
}

async function carregarBases() {

    dados_departamentos = await recuperarDados('dados_departamentos') || {}
    if (Object.keys(dados_departamentos) == 0) {
        await sincronizar_departamentos()
    }

    let clientesOmie = await recuperarDados('dados_clientes')

    dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {};
    if (!dados_agenda_tecnicos || Object.keys(dados_agenda_tecnicos).length == 0) {
        await recuperar_agenda();
    }

    for ([codigoFuncionario, objeto] of Object.entries(dados_agenda_tecnicos)) {
        objeto.nome = clientesOmie[codigoFuncionario]?.nome || codigoFuncionario;
    }

    let ordenado = Object.entries(dados_agenda_tecnicos)
        .sort((a, b) => a[1].nome.localeCompare(b[1].nome));

    dados_agenda_tecnicos = Object.fromEntries(ordenado)

    dados_categorias = await recuperarDados('dados_categorias') || {}
    categoriasChaves = dados_categorias
    if (!dados_categorias || Object.keys(dados_categorias) == 0) dados_categorias = await receber('dados_categorias', 0)
    dados_categorias = Object.entries(dados_categorias).sort((a, b) => {
        return a[1].localeCompare(b[1])
    })

}

async function apagar_dia(diaOmieTecnico) {

    let [dia, omie_tecnico] = diaOmieTecnico.split('_')
    let div = document.getElementById(diaOmieTecnico).previousElementSibling

    let mes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value

    let ano_mes = `${ano}_${meses[mes]}`
    let tecnico = dados_agenda_tecnicos[omie_tecnico]

    delete tecnico?.agendas[ano_mes]?.[dia]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${ano_mes}/${dia}`)

    let td = div.parentElement
    td.style.backgroundColor = 'white'
    td.querySelector('input').style.color = 'black' // Input dentro da td
    div.style.display = 'none'
    div.nextElementSibling.value = ''

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}

async function confirmar_apagar_agenda(omie_tecnico) {

    let clientesOmie = await recuperarDados('dados_clientes') || {}

    popup(`
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 2vw;">
            <label>Apagar a agenda deste mês para este técnico?</label>
            <label>${clientesOmie?.[omie_tecnico]?.nome || omie_tecnico}</label>
            <button style="background-color: #4CAF50;" onclick="apagar_agenda('${omie_tecnico}')">Confirmar</button>
        </div>
        `, 'Aviso', true)

}

async function apagar_agenda(omie_tecnico) {

    removerPopup()

    let mes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value

    let ano_mes = `${ano}_${meses[mes]}`
    let tecnico = dados_agenda_tecnicos[omie_tecnico]

    delete tecnico?.agendas[ano_mes]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${ano_mes}`)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    carregar_tabela()

}

async function abrir_opcoes() {

    let acumulado = `

        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; background-color: #d2d2d2; padding: 2vw;">

            <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <label>Escolha o Funcionário</label>
                <textarea id="textareaFuncionario" oninput="sugestoes(this, true)"></textarea>
                <div></div>
            </div>

            <div class="btn" onclick="recuperarClientes()">
                <img src="imagens/omie.png">
                <label style="cursor: pointer;">Atualizar OMIE Clientes</label>
            </div>

        </div>
    `
    popup(acumulado, 'Novo Funcionário')
}

async function sugestoes(input, tecnicos) {

    let clientesOmie = await recuperarDados('dados_clientes') || {}
    let pesquisa = String(input.value).toLowerCase()
    let opcoes = ''

    if (!tecnicos) {
        let dados_departamentos = await recuperarDados('dados_departamentos') || {}

        for (omie in dados_departamentos) {
            let item = dados_departamentos[omie]
            let descricao = item.descricao.toLowerCase()
            if (descricao.includes(pesquisa)) {
                opcoes += `
                <div onclick="definir_campo('${input.id}', '${omie}', '${item.descricao}')" class="autocomplete-item" style="font-size: 0.8vw;">${item.descricao}</div>`
            }
        }

    } else { // No caso de ser as sugestões para novo técnico

        for (omieCodigo in clientesOmie) {
            let cliente = clientesOmie[omieCodigo]
            if (String(cliente.nome).toLowerCase().includes(pesquisa)) {
                opcoes += `
                <div class="autocomplete-item" style="font-size: 0.8vw;" onclick="escolher_tecnico('${omieCodigo}', '${cliente.nome}')">${cliente.nome}</div>
                `
            }
        }

    }

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    let posicao = input.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div = `
        <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
            ${opcoes}
        </div>
    `
    if (pesquisa == '') { // O usuário apagou o campo, então limpa na agenda...

        if (tecnicos) {
            document.getElementById('textareaFuncionario').nextElementSibling.innerHTML = ''
        } else {
            await definir_campo(input.id, '', '')
        }

        return

    }

    if (opcoes == '') return

    document.body.insertAdjacentHTML('beforeend', div)
}

async function escolher_tecnico(omie_tecnico, nome_tecnico) {

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    // Caso seja apenas a tela de Lançamento;
    let telaLancamento = document.getElementById('telaLancamento')
    let textarea = document.getElementById('textareaFuncionario')
    textarea.value = nome_tecnico

    if (telaLancamento) {
        textarea.previousElementSibling.value = omie_tecnico
        return
    }

    if (dados_agenda_tecnicos[omie_tecnico]) {
        return popup(mensagem('Técnico já existente na base'), 'Aviso', true)

    } else {

        textarea.nextElementSibling.innerHTML = `
            <button style="background-color: #4CAF50;" onclick="salvar_tecnico('${omie_tecnico}')">Confirmar</button>
        `
    }

}

async function salvar_tecnico(omie_tecnico) {

    dados_agenda_tecnicos[omie_tecnico] = {
        omie: omie_tecnico,
        regiao_atual: 'Sem Região',
        agendas: {}
    }

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    enviar(`dados_agenda_tecnicos/${omie_tecnico}`, dados_agenda_tecnicos[omie_tecnico])

    removerPopup()

    await carregar_tabela()

}

async function definir_campo(input_id, omie_departamento, descricao) {

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    if (input_id == '' || omie_departamento == '') {
        return
    }

    if (input_id == 'departamentoFixo') {
        let textarea = document.getElementById(input_id)
        textarea.value = descricao
        textarea.parentElement.nextElementSibling.value = omie_departamento
        return
    }

    let dia_tecnico = input_id.split('_')
    let omie_tecnico = dia_tecnico[1]
    let dia = dia_tecnico[0]
    let ano = document.getElementById('ano').value
    let mes = document.getElementById('mes').value

    let tecnico = dados_agenda_tecnicos?.[omie_tecnico] || {}
    let chave_da_agenda = `${ano}_${meses[mes]}`

    if (!tecnico.agendas) {
        tecnico.agendas = {}
    }

    if (!tecnico.agendas[chave_da_agenda]) {
        tecnico.agendas[chave_da_agenda] = {}
    }

    if (!tecnico.agendas[chave_da_agenda][dia]) {
        tecnico.agendas[chave_da_agenda][dia] = {}
    }

    if (tecnico.agendas[chave_da_agenda][dia]?.departamento == omie_departamento) {
        return
    }

    let dados = {
        departamento: omie_departamento,
        usuario: acesso.usuario,
        data: data_atual('completa')
    }

    let input = document.getElementById(input_id)
    input.parentElement.id = omie_departamento // ID da td é o cod_departamento; 
    input.previousElementSibling.style.display = omie_departamento != '' ? 'block' : 'none'
    input.value = descricao
    input.nextElementSibling.textContent = acesso.usuario
    input.nextElementSibling.nextElementSibling.textContent = data_atual('completa')

    colorir_tabela()

    tecnico.agendas[chave_da_agenda][dia] = dados
    await enviar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${chave_da_agenda}/${dia}`, dados)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}

async function filtrar_por_regiao() {

    let campo_tecnico_pesquisa = String(document.getElementById('campo_tecnico_pesquisa').value).toLowerCase();
    let tabela = document.querySelector('table');
    let tbody = tabela.querySelector('tbody');
    let trs = tbody.querySelectorAll('tr');

    let filtros_regioes = document.getElementById('filtros_regioes');
    let inputs = filtros_regioes.querySelectorAll('input');
    let regioes_ativas = JSON.parse(localStorage.getItem('regioes_ativas')) || [];

    inputs.forEach(input => {
        let regiao = input.previousElementSibling.textContent;
        input.checked = regioes_ativas.includes(regiao);
    });

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        let codigo_tecnico = tds[1].id;
        let regiao_do_tecnico = dados_agenda_tecnicos?.[codigo_tecnico]?.regiao_atual || '';
        let nome_tecnico = String(tds[1].textContent).toLowerCase();

        let mostrar_linha =
            (regioes_ativas.length === 0 || regioes_ativas.includes(regiao_do_tecnico)) &&
            (campo_tecnico_pesquisa === '' || nome_tecnico.includes(campo_tecnico_pesquisa));

        tr.style.display = mostrar_linha ? 'table-row' : 'none';
    });
}

async function incluir_regiao(input) {
    let regiao = input.previousElementSibling.textContent;
    let regioes_ativas = JSON.parse(localStorage.getItem('regioes_ativas')) || [];

    if (input.checked) {
        if (!regioes_ativas.includes(regiao)) {
            regioes_ativas.push(regiao);
        }
    } else {
        let posicao = regioes_ativas.indexOf(regiao);
        if (posicao !== -1) {
            regioes_ativas.splice(posicao, 1);
        }
    }

    localStorage.setItem('regioes_ativas', JSON.stringify(regioes_ativas));
    await filtrar_por_regiao();
}

async function abrirDetalhes(codigo_tecnico) {

    let clientesOmie = await recuperarDados('dados_clientes') || {}
    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    let atual = tecnico.regiao_atual

    let divDepFixos = ''
    if (tecnico.departamentos_fixos) {

        for ([dep, obj] of Object.entries(tecnico.departamentos_fixos)) {

            divDepFixos += `
            <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                <img src="imagens/remover.png" style="width: 2vw; cursor: pointer;" onclick="gerenciarDepartamentoFixo('${dep}', '${codigo_tecnico}', 'remover')">
                <label style="padding: 3px; border-radius: 3px; width: 5vw;">${conversor(obj.distribuicao.toFixed(0))}%</label>
                <label>${dados_departamentos[dep].descricao}</label>
            </div>
            `
        }
    }

    let opcoes = `
        <option></option>
    `

    regioes.forEach(regiao => {
        opcoes += `
        <option  ${atual == regiao ? 'selected' : ''}>${regiao}</option>
        `
    })

    let acumulado = `
    <div style="padding: 2vw; background-color: #d2d2d2;">
        <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; margin: 2vw; gap: 2vh;">
            <label><strong>${clientesOmie?.[codigo_tecnico]?.nome || codigo_tecnico}</strong></label>
            <select onchange="alterar_regiao(this, ${codigo_tecnico})" class="select_regiao">
                ${opcoes}
            </select>
        </div>
        <hr>
        <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
            <label>Apagar essa agenda?</label>
            <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;" onclick="confirmar_apagar_agenda('${codigo_tecnico}')">
        </div>

        ${acesso.permissao == 'adm' ?
            `<hr>
        <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
            <label>Apagar o Funcionário?</label>
            <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;" onclick="confirmar_apagar_tecnico('${codigo_tecnico}')">
        </div>
        ` : ''}

        <hr>
        <div style="display: flex; align-items: start; justify-content: start; gap: 5px; flex-direction: column;">
            <label>Departamentos Fixos</label>

            <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                <textarea id="departamentoFixo" oninput="sugestoes(this)"></textarea>
                <img src="imagens/concluido.png" style="width: 2vw; cursor: pointer;" onclick="gerenciarDepartamentoFixo(this.parentElement.nextElementSibling.value, '${codigo_tecnico}', 'incluir')">
            </div>
            <input style="display: none;">
        <div>
        
        <div style="display: flex; align-items: start; justify-content: start; gap: 5px; flex-direction: column;">
            ${divDepFixos}
        </div>
    </div>
    `

    popup(acumulado, 'Configurações', true)

}

async function gerenciarDepartamentoFixo(omieDepartamento, codigoFuncionario, operacao) {

    overlayAguarde()

    let funcionario = dados_agenda_tecnicos[codigoFuncionario]

    let depFixos = {}

    if (operacao == 'incluir') {
        if (!funcionario.departamentos_fixos) {
            funcionario.departamentos_fixos = {}
        }

        depFixos = funcionario.departamentos_fixos
        depFixos[omieDepartamento] = {}

    } else {
        depFixos = funcionario.departamentos_fixos
        delete depFixos[omieDepartamento]
    }

    let tamanho = Object.keys(depFixos).length
    let divisao = tamanho == 0 ? 100 : 100 / tamanho

    for ([omieDepartamento, objeto] of Object.entries(depFixos)) {
        objeto.distribuicao = divisao
    }

    enviar(`dados_agenda_tecnicos/${codigoFuncionario}/departamentos_fixos`, depFixos)
    removerPopup()
    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')
    await carregar_tabela()
    await abrirDetalhes(codigoFuncionario)

}

async function confirmar_apagar_tecnico(omieFuncionario) {

    let clientesOmie = await recuperarDados('dados_clientes') || {}
    let funcionario = clientesOmie[omieFuncionario]

    popup(`
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Apagar este técnico?</label>
            <label>${funcionario?.nome || omieFuncionario}</label>
            <button style="background-color: #4CAF50;" onclick="apagar_tecnico('${omieFuncionario}')">Confirmar</button>
        </div>
        `, 'Aviso')

}

async function apagar_tecnico(omie_tecnico) {

    removerPopup()

    delete dados_agenda_tecnicos[omie_tecnico]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}`)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    await carregar_tabela()

}

async function alterar_regiao(select, codigo_tecnico) {

    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    tecnico.regiao_atual = select.value

    enviar(`dados_agenda_tecnicos/${codigo_tecnico}/regiao_atual`, select.value)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    await carregar_tabela()
    filtrar_por_regiao()

}

function colorir_tabela() {

    let departamentos = JSON.parse(localStorage.getItem('cores_departamentos')) || {}
    let tabela = document.querySelector('table')
    let tbody = tabela.querySelector('tbody')
    let trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')

        tds.forEach((td, i) => {

            let input = td.querySelector('input')

            if (input && input.value != '') {

                if (!departamentos[input.value]) {

                    let estilos = back_fonte()
                    departamentos[input.value] = {
                        bg: estilos.corFundo,
                        cor: estilos.corTexto
                    }
                }

                td.style.backgroundColor = departamentos[input.value].bg
                input.style.color = departamentos[input.value].cor

            }

        })

    })

    localStorage.setItem('cores_departamentos', JSON.stringify(departamentos))

}

function back_fonte() {
    let corFundo = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    let r = parseInt(corFundo.substring(1, 3), 16);
    let g = parseInt(corFundo.substring(3, 5), 16);
    let b = parseInt(corFundo.substring(5, 7), 16);

    let luminosidade = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    let corTexto = luminosidade > 0.5 ? "#000000" : "#FFFFFF";

    return { corFundo, corTexto };
}

function nome_em_destaque(elemento, mostrar) {

    let etiqueta = document.getElementById('etiqueta')
    if (etiqueta) {
        etiqueta.remove()
    }

    if (mostrar && elemento.value !== '') {

        let usuario = elemento.nextElementSibling
        let data = usuario.nextElementSibling
        let posicao = elemento.getBoundingClientRect()
        let left = posicao.left + window.scrollX
        let top = posicao.bottom + window.scrollY

        let acumulado = `
            <div id="etiqueta" style="top: ${top}px; left: ${left}px; display: flex; align-items: start; justify-content: start; gap: 5px; flex-direction: column;">
                <label>${elemento.value}</label>
                <label>${usuario.textContent}</label>
                <label>${data.textContent}</label>
            </div>
        `
        document.body.insertAdjacentHTML('beforeend', acumulado)
    }

}

let relatorios = {
    tecnico: {},
    departamentos: { total: 0 }
}

async function distribuicaoFuncionario() {

    removerPopup()
    let clientesOmie = await recuperarDados('dados_clientes') || {}
    let permitidos = ['adm', 'fin']
    let setores = ['FINANCEIRO']
    let totaisCategoria = {}

    if (!permitidos.includes(acesso.permissao) && !setores.includes(acesso.setor)) {
        let mensagem = `
            <div id="aviso_campo_branco" style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Apenas setores RH, ADM e FINANCEIRO estão liberados para este painel</label>
            </div>
        `
        return popup(mensagem, 'Aviso')
    }

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let pagamentosPorFuncionario = {}
    let ano = document.getElementById('ano').value
    let mes = document.getElementById('mes').value

    for ([idPagamento, pagamento] of Object.entries(lista_pagamentos)) {

        if (pagamento.omie_funcionario && pagamento.mes == mes && pagamento.ano == ano) { // Mesmo período

            if (!pagamentosPorFuncionario[pagamento.omie_funcionario]) {
                pagamentosPorFuncionario[pagamento.omie_funcionario] = []
            }

            pagamentosPorFuncionario[pagamento.omie_funcionario].push(pagamento)
        }
    }

    let opcoesCategorias = ''
    opcoesCategorias += `
        <option></option>
    `
    dados_categorias.forEach(categoria => {
        let [codigo, descricao] = categoria
        opcoesCategorias += `
            <option value="${codigo}">${descricao}</option>
        `
    })

    let acumulado = ''
    let linhas = ''
    let chaveAgenda = `${ano}_${meses[mes]}`
    auxPagamFuncionario = {} // Reiniciar este contador para lançamentos futuros;

    for ([codigoFuncionario, objeto] of Object.entries(dados_agenda_tecnicos)) {

        let agenda = objeto.agendas[chaveAgenda]
        let labelsDistribuicao = ''

        if (!auxPagamFuncionario[codigoFuncionario]) {
            auxPagamFuncionario[codigoFuncionario] = { distribuicao: [] }
        }

        if (objeto.departamentos_fixos) {

            for ([departamento, objeto] of Object.entries(objeto.departamentos_fixos)) {

                labelsDistribuicao += `
                <label style="text-align: left;"><strong>${objeto.distribuicao}%</strong> ${dados_departamentos?.[departamento]?.descricao || '??'}</label>`

                auxPagamFuncionario[codigoFuncionario].distribuicao.push({
                    cCodDep: departamento,
                    nPerDep: objeto.distribuicao
                })
            }

        } else if (agenda) {
            let contadores = {}
            let total = 0

            for (let [dia, objeto] of Object.entries(agenda)) {
                if (!contadores[objeto.departamento]) contadores[objeto.departamento] = 0
                contadores[objeto.departamento]++
                total++
            }

            for (let [departamento, quantidade] of Object.entries(contadores)) {
                let porcentagem = quantidade / total
                labelsDistribuicao += `
                <label><strong>${conversor(porcentagem.toFixed(2))}%</strong> ${dados_departamentos?.[departamento]?.descricao || '??'}</label>`

                auxPagamFuncionario[codigoFuncionario].distribuicao.push({
                    cCodDep: departamento,
                    nPerDep: Number((porcentagem * 100).toFixed(7))
                })
            }
        }

        let labelsPagamentos = ''
        if (pagamentosPorFuncionario[codigoFuncionario]) {
            pagamentosPorFuncionario[codigoFuncionario].forEach(pagamento => {

                let param = pagamento.param[0]
                let codCategoria = param.categorias[0].codigo_categoria
                let nomeCategoria = categoriasChaves[codCategoria]
                if (!totaisCategoria[nomeCategoria]) {
                    totaisCategoria[nomeCategoria] = 0
                }

                let distPagamento = JSON.stringify(pagamento.param[0].distribuicao)
                let distAtual = JSON.stringify(auxPagamFuncionario[codigoFuncionario]?.distribuicao || [])

                let imagem = distPagamento != distAtual ? 'reprovado' : 'aprovado'

                totaisCategoria[nomeCategoria] += param.valor_documento

                labelsPagamentos += `
                    <div class="divValores" id="${pagamento.id_pagamento}" onclick="atualizarDepartamentos(this, ${codigoFuncionario})">
                        <img src="imagens/${imagem}.png" style="width: 2vw;">
                        <div style="display: flex; align-items: start; justify-content: start; flex-direction: column;">
                            <label style="font-size: 0.7vw;"><strong>${nomeCategoria}</strong></label>
                            <label style="font-size: 0.7vw;">${pagamento.param[0].data_vencimento}</label>
                            <label style="font-size: 0.9vw;">${dinheiro(param.valor_documento)}</label>
                        </div>
                    </div>
                    `
            })
        }

        linhas += `
            <tr>
                <td id="${codigoFuncionario}">
                    <div style="display: flex; align-items: center; justify-content: start; gap: 1vw; margin-left: 5px;">
                        <img src="imagens/construcao.png" style="width: 2vw; cursor: pointer;" onclick="abrirDetalhes('${codigoFuncionario}')">
                        <label style="text-align: left;">${clientesOmie[codigoFuncionario]?.nome || codigoFuncionario}</label>
                    </div>
                </td>
                <td><input type="number" class="opcoesSelect" style="width: max-content;"></td>
                <td>${objeto?.regiao_atual || 'Sem Região'}</td>
                <td>
                    <div style="display: flex; justify-content: start; flex-direction: column; align-items: start;">
                        ${labelsDistribuicao}
                    </div>
                </td>
                <td>
                    <div style="display: flex; justify-content: start; flex-direction: column; align-items: start; gap: 2px;">
                        ${labelsPagamentos}
                    </div>
                </td>
            </tr>
        `
    }

    let ths = ''
    let tsh = ''
    let colunas = ['Funcionário', 'Valores', 'Setor', 'Distribuição', 'Pagamentos Realizados']
        .map((col, i) => {
            ths += `<th style="color: white;">${col}</th>`
            tsh += `<th style="background-color: white;">
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <input oninput="pesquisar_generico(${i}, this.value, filtroPagamentos,'tbodyPagamentos')">
                            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                        </div>
                    </th>
            `
        })

    let tabela = `
        <table class="tabela">
            <thead style="background-color: #797979;">
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="tbodyPagamentos">
                ${linhas}
            </tbody>
        </table>
    `

    let resumoValoresCategorias = ''

    for (categoria in totaisCategoria) {
        resumoValoresCategorias += `
        <div class="resumoCategorias">
            <label style="font-size: 0.9vw;">${categoria}</label>
            <label>${dinheiro(totaisCategoria[categoria])}</label>
        </div>
        `
    }

    acumulado = `
        <div style="gap: 5px; background-color: #d2d2d2; display: flex; flex-direction: column; align-items: start; justify-content: start; padding: 2vw;">
            <label>Tabela de Distribuição</label>
            <hr style="width: 100%;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">

                <div style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 5px;">
                    <label>Categoria</label>
                    <select id="categoriaPagamentos">
                        ${opcoesCategorias}
                    </select>
                    <label>Data de Vencimento</label>
                    <input id="vencimentoPagamentos" type="date" style="padding: 5px; border-radius: 3px;">
                    <label>Observação</label>
                    <textarea id="observacaoPagamentos"></textarea>
                    <hr style="width: 100%;">
                    <button style="background-color: #4CAF50" onclick="enviarPagamentos()">Enviar Pagamentos</button>
                </div>

                <div style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 5px;">
                    ${resumoValoresCategorias}
                </div>
            </div>
            ${tabela}
        </div>
    `

    popup(acumulado, 'Distribuição por Funcionário')

}

async function atualizarDepartamentos(divMaior, codFuncionario) {

    overlayAguarde()

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    let pagamento = lista_pagamentos[divMaior.id]

    pagamento.param[0].distribuicao = auxPagamFuncionario[codFuncionario].distribuicao

    let resposta = await lancar_pagamento(pagamento, 'AlterarContaPagar')

    if (!resposta.faultstring) {
        await inserirDados(lista_pagamentos, 'lista_pagamentos')
        divMaior.querySelector('img').src = 'imagens/aprovado.png'
    }

    popup(mensagem(resposta.faultstring ? resposta.faultstring : resposta.descricao_status), 'AVISO', true)

}

async function enviarPagamentos() {

    overlayAguarde()
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let tbody = document.getElementById('tbodyPagamentos')
    let mes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value
    let categoria = document.getElementById('categoriaPagamentos').value
    let observacao = document.getElementById('observacaoPagamentos').value
    let vencimento = document.getElementById('vencimentoPagamentos').value
    let pagamentos = []
    let trs = tbody.querySelectorAll('tr')

    let campos = [
        { nome: 'Categoria', valor: categoria },
        { nome: 'Observação', valor: observacao },
        { nome: 'Vencimento', valor: vencimento }
    ]

    for (let campo of campos) {
        if (!campo.valor) {
            return popup(mensagemHTML(campo.nome), 'Aviso', true)
        }
    }

    let [anoInput, mesInput, diaInput] = vencimento.split('-')
    vencimento = `${diaInput}/${mesInput}/${anoInput}`

    for (tr of trs) {

        let tds = tr.querySelectorAll('td')
        let omieFuncionario = tds[0].id
        let idPagamento = unicoID()
        let valorDocumento = Number(tds[1].querySelector('input').value)

        if (valorDocumento == 0) continue

        let distribuicao = auxPagamFuncionario[omieFuncionario]?.distribuicao

        if (!distribuicao) distribuicao = []

        let param = [
            {
                "codigo_cliente_fornecedor": omieFuncionario,
                "valor_documento": valorDocumento,
                "observacao": observacao,
                "codigo_lancamento_integracao": idPagamento,
                "data_vencimento": vencimento,
                "categorias": [{
                    codigo_categoria: categoria,
                    valor: valorDocumento
                }],
                "data_previsao": vencimento,
                "id_conta_corrente": 6054234828, // Itaú AC
                "distribuicao": distribuicao,
                "status_titulo": 'PAG'
            }
        ]

        pagamentos[idPagamento] = {
            mes,
            ano,
            omie_funcionario: omieFuncionario,
            categoria,
            status: 'AGENDA',
            id_pagamento: idPagamento,
            id_orcamento: 'AGENDA',
            departamento: 'AGENDA',
            data_registro: data_atual('completa'),
            anexos: {},
            anexos_parceiros: {},
            criado: acesso.usuario,
            param,
        }
    }

    let acumulado = `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
                <img src="gifs/loading.gif" style="width: 3vw;">
                <label id="carregamento">Carregando...</label>
            </div>
        `

    popup(acumulado, 'Carregando', true)
    let carregamento = document.getElementById('carregamento')
    let tamanho = Object.keys(pagamentos).length
    let i = 1
    for (let [idPagamento, pagamento] of Object.entries(pagamentos)) {

        carregamento.textContent = `${((i / tamanho) * 100).toFixed(0)}%`

        let resposta = await lancar_pagamento(pagamento)

        if (resposta.faultstring) pagamento.status = 'Não lançado'

        lista_pagamentos[idPagamento] = pagamento
        enviar(`lista_pagamentos/${idPagamento}`, pagamento)
        i++
    }

    await inserirDados(lista_pagamentos, 'lista_pagamentos')

    removerPopup()
    await distribuicaoFuncionario()

}

// Arrastar elementos
let tabela;
let isDragging = false
let startCell = null
let startRow, startCol, endRow, endCol

function getCellCoords(cell) {
    const row = cell.parentElement.rowIndex
    const col = cell.cellIndex
    return { row, col }
}

function clearSelection() {
    const sel = tabela.querySelectorAll('.selected')
    sel.forEach(td => td.classList.remove('selected'))
}

function arrastarCelulas() {

    tabela = document.getElementById('tabelaAgenda')

    tabela.addEventListener('mousedown', e => {
        if (e.target.tagName !== 'TD') return

        isDragging = true
        startCell = e.target
        const coords = getCellCoords(startCell)
        startRow = coords.row
        startCol = coords.col

        clearSelection()
        e.target.classList.add('selected')
    })

    tabela.addEventListener('mouseover', e => {
        if (!isDragging || e.target.tagName !== 'TD') return clearSelection()
        if (!e.target.querySelector('input')) return clearSelection()

        clearSelection()
        const coords = getCellCoords(e.target)
        endRow = coords.row
        endCol = coords.col

        let minRow = Math.min(startRow, endRow)
        let maxRow = Math.max(startRow, endRow)
        let minCol = Math.min(startCol, endCol)
        let maxCol = Math.max(startCol, endCol)

        for (let i = minRow; i <= maxRow; i++) {
            for (let j = minCol; j <= maxCol; j++) {
                tabela.rows[i].cells[j].classList.add('selected')
            }
        }
    })

    tabela.addEventListener('mouseup', async () => {
        if (!isDragging) return
        isDragging = false

        const inputStartCell = startCell.querySelector('input')
        const selecionadas = tabela.querySelectorAll('.selected')
        let celulasAtualizacao = {}

        for (cell of selecionadas) {
            let inputCell = cell.querySelector('input')
            let divCell = cell.querySelector('div')

            if (!divCell || !inputCell) continue

            divCell.style.display = 'block' // Mini triângulo que aparece no canto de cima da td;
            inputCell.value = inputStartCell.value // Texto visível no input, que é o nome do departamento;
            cell.id = startCell.id // ID que representa o departamento, pode flutuar entre as linhas normalmente, mas o ID do input é do técnico, deve ser mantido o original;

            celulasAtualizacao[inputCell.id] = { departamentoOmie: startCell.id, nomeDepartamento: inputStartCell.value }
        }

        for ([diaTecnico, objeto] of Object.entries(celulasAtualizacao)) {

            if (objeto.departamentoOmie == '') {
                await apagar_dia(diaTecnico)
            } else {
                await definir_campo(diaTecnico, objeto.departamentoOmie, objeto.nomeDepartamento)
            }

        }

        colorir_tabela()
        clearSelection()
    })

}