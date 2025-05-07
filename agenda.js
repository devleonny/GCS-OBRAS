let filtro_tecnicos = {}

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

let regioes = ['Nordeste', 'Norte', 'Sudeste', 'Sul', 'Centro-Oeste', 'Sem Região', 'Clientes Novos']

iniciar_agendas()

async function iniciar_agendas() {
    await carregar_tabela()
    filtrar_por_regiao()
}

async function sincronizar_departamentos() {

    let aguarde = document.getElementById('aguarde')
    if (!aguarde) {
        document.body.insertAdjacentHTML('beforeend', overlay_aguarde())
    }
    
    await sincronizar('departamentos')
    let dados_departamentos = await receber('dados_departamentos')
    await inserirDados(dados_departamentos, 'dados_departamentos')

    remover_popup()
    return dados_departamentos
}

async function carregar_tabela(sinc) {

    document.body.insertAdjacentHTML('beforeend', overlay_aguarde())

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos')
    let dados_clientes = await recuperarDados('dados_clientes')
    let clientes_invertidos = {}

    let dados_departamentos = await recuperarDados('dados_departamentos') || {}
    if (Object.keys(dados_departamentos) == 0) {
        dados_departamentos = await sincronizar_departamentos()
    }

    for (id in dados_clientes) {
        let cliente = dados_clientes[id]
        clientes_invertidos[cliente.omie] = cliente
    }

    if (sinc || !dados_agenda_tecnicos || Object.keys(dados_agenda_tecnicos).length == 0) {
        dados_agenda_tecnicos = await receber('dados_agenda_tecnicos')
        await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')
    }

    let select_ano = document.getElementById('ano')?.value || 2025
    let selec_mes = document.getElementById('mes')?.value || 'Janeiro'

    let string_meses = ''
    let mes_atual = new Date().getMonth()

    for (mes in meses) {

        string_meses += `
            <option ${(!document.getElementById('ano') && meses[mes] === mes_atual) ? 'selected' : ''}>${mes}</option>
        `
        if (!document.getElementById('ano') && meses[mes] === mes_atual) {
            selec_mes = mes
        }
    }

    let linhas = ''
    let dias = new Date(select_ano, meses[selec_mes] + 1, 0).getDate() // Último dia do mês, simples...
    let ths = `
        <th>Técnicos</th>
        <th>Região</th>
        <th>Config</th>
    `
    for (let i = 1; i <= dias; i++) { // Cabeçalho dias/Semanas do mês
        let data = new Date(select_ano, meses[selec_mes], i)

        ths += `
        <th>
            <div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <label>${i}</label>
                <label>${semana[data.getDay()]}</label>
            </div>
        </th>
        `
    }

    for (omie_tecnico in dados_agenda_tecnicos) {
        let tecnico = dados_agenda_tecnicos[omie_tecnico]
        let celulas_dias = ''
        let agenda = {}
        let periodo = `${select_ano}_${meses[selec_mes]}`

        if (tecnico.agendas && tecnico.agendas[periodo]) {
            agenda = tecnico.agendas[periodo]
        }

        for (let i = 1; i <= dias; i++) { // tds, células da agenda de cada técnico;
            let cod_departamento = agenda?.[i]?.departamento || ''
            let info = dados_departamentos?.[cod_departamento]?.descricao || cod_departamento

            celulas_dias += `
                <td id="${cod_departamento}" style="position: relative;">
                    <div style="display: ${info != '' ? 'block' : 'none'}" class="com-triangulo" onclick="apagar_dia('${i}', '${omie_tecnico}', this)"></div>
                    <input id="${i}_${omie_tecnico}" style="cursor: grab; width: 3vw; background-color: transparent;" onmouseout="nome_em_destaque(this, false)" onmouseover="nome_em_destaque(this, true)" oninput="sugestoes(this)" value="${info}">
                    <label style="display: none;">${agenda?.[i]?.usuario || ''}</label>
                    <label style="display: none;">${agenda?.[i]?.data || ''}</label>
                </td>
            `
        }

        // Coluna 1: Nome do técnico;
        // Coluna 2: Região;
        // Coluna 3: Cofig;

        let regiao = dados_agenda_tecnicos[omie_tecnico]?.regiao_atual || 'Sem Região'

        linhas += `
        <tr>
            <td id="${omie_tecnico}">
                <label style="font-size: 0.7vw;">${clientes_invertidos[omie_tecnico]?.nome || omie_tecnico}</label>
            </td>
            <td>
                <label style="font-size: 0.7vw;">${regiao}</label>
            </td>
            <td style="text-align: center;">
                <img src="imagens/construcao.png" style="width: 2vw; cursor: pointer;" onclick="abrir_detalhes('${omie_tecnico}')">
            </td>
            ${celulas_dias}
        </tr>
        `
    }

    let string_regioes = ''
    regioes.forEach(regiao => {
        string_regioes += `
        <div style="display: flex; align-items: center; justify-content: left; gap: 2px;">
            <input style="width: 2vw; height: 2vw; cursor: pointer;" type="checkbox" onchange="incluir_regiao(this)">
            <label style="font-size: 0.8vw;">${regiao}</label>
        </div>
        `
    })

    let tabela = `
        <div class="fundo_tabela" id="dados_agenda">
            <table id="tabelaAgenda" class="tabela" style="table-layout: fixed;">
                <thead>
                    ${ths}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `

    let acumulado = `
    <div class="fundo">

        <div style="color: white; display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 1vw; width: 17vw;">

            <label>Mês</label>
            <select id="mes" onchange="iniciar_agendas()">
                ${string_meses}
            </select>

            <hr style="width: 100%;">

            <label>Ano</label>
            <select id="ano" onchange="iniciar_agendas()">
                <option>2025</option>
                <option>2026</option>
            </select>

            <hr style="width: 100%;">

            <label>Técnico</label>
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

    colorir_tabela()

    remover_popup()

    filtrar_tabela('0', 'tabelaAgenda') // Script genérico que organiza a tabela com base na coluna e no ID da tabela.
}

async function apagar_dia(dia, omie_tecnico, div) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let mes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value

    let ano_mes = `${ano}_${meses[mes]}`
    let tecnico = dados_agenda_tecnicos[omie_tecnico]

    delete tecnico?.agendas[ano_mes]?.[dia]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${ano_mes}/${dia}`)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    div.style.display = 'none'
    div.nextElementSibling.value = ''
    colorir_tabela()

}

async function confirmar_apagar_agenda(omie_tecnico) {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_invertido = {}
    for (cnpj in dados_clientes) {
        let cliente = dados_clientes[cnpj]
        dados_clientes_invertido[cliente.omie] = cliente
    }

    openPopup_v2(`
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Apagar a agenda deste mês para este técnico?</label>
            <label>${dados_clientes_invertido?.[omie_tecnico]?.nome || omie_tecnico}</label>
            <button style="background-color: #4CAF50;" onclick="apagar_agenda('${omie_tecnico}')">Confirmar</button>
        </div>
        `, 'Aviso')

}

async function apagar_agenda(omie_tecnico) {

    remover_popup()

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
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
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Escolha um Técnico:</label>
            <textarea id="textarea_tecnico" oninput="sugestoes(this, true)"></textarea>
            <div></div>
        </div>
    `

    openPopup_v2(acumulado, 'Novo Técnico')
}

async function sugestoes(input, tecnicos) {

    let pesquisa = String(input.value).toLowerCase()
    let opcoes = ''

    if (!tecnicos) {
        let dados_departamentos = await recuperarDados('dados_departamentos') || {}

        dados_departamentos = { // Opções extras além dos departamentos que chegam da API, inclua aqui... 
            ...dados_departamentos,
            'FERIAS': { codigo: 'FERIAS', descricao: 'FERIAS', omie: 'FERIAS' },
            'FOLGA': { codigo: 'FOLGA', descricao: 'FOLGA', omie: 'FOLGA' },
            'EM CASA': { codigo: 'EM CASA', descricao: 'EM CASA', omie: 'EM CASA' },
            'EM VIAGEM': { codigo: 'EM VIAGEM', descricao: 'EM VIAGEM', omie: 'EM VIAGEM' },
            'ATESTADO': { codigo: 'ATESTADO', descricao: 'ATESTADO', omie: 'ATESTADO' },
            'FERIADO': { codigo: 'FERIADO', descricao: 'FERIADO', omie: 'FERIADO' }
        }

        for (omie in dados_departamentos) {
            let item = dados_departamentos[omie]
            let descricao = item.descricao.toLowerCase()
            if (descricao.includes(pesquisa)) {
                opcoes += `
                <div onclick="definir_campo('${input.id}', '${omie}', '${item.descricao}')" class="autocomplete-item" style="font-size: 0.8vw;">${item.descricao}</div>
            `
            }
        }

    } else { // No caso de ser as sugestões para novo técnico

        let dados_clientes = await recuperarDados('dados_clientes') || {}

        for (cnpj in dados_clientes) {
            let cliente = dados_clientes[cnpj]
            if (String(cliente.nome).toLowerCase().includes(pesquisa)) {
                opcoes += `
                <div class="autocomplete-item" style="font-size: 0.8vw;" onclick="escolher_tecnico('${cliente.omie}', '${cliente.nome}')">${cliente.nome}</div>
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
            document.getElementById('textarea_tecnico').nextElementSibling.innerHTML = ''
        } else {
            await definir_campo(input.id, '', '')
        }

        return

    }

    if (opcoes == '') {
        return
    }

    document.body.insertAdjacentHTML('beforeend', div)
}

async function escolher_tecnico(omie_tecnico, nome_tecnico) {

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }
    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}

    if (dados_agenda_tecnicos[omie_tecnico]) {
        openPopup_v2(`
            <div style="margin: 10px;">
                <label>Técnico já existente na base!</label>
            </div>
            `
            , 'Aviso', true)
        return

    } else {
        let textarea = document.getElementById('textarea_tecnico')

        textarea.nextElementSibling.innerHTML = `
            <button style="background-color: #4CAF50;" onclick="salvar_tecnico('${omie_tecnico}')">Confirmar</button>
        `
        textarea.value = nome_tecnico

    }

}

async function salvar_tecnico(omie_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}

    dados_agenda_tecnicos[omie_tecnico] = {
        omie: omie_tecnico,
        regiao_atual: 'Sem Região',
        agendas: {}
    }

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    enviar(`dados_agenda_tecnicos/${omie_tecnico}`, dados_agenda_tecnicos[omie_tecnico])

    remover_popup()

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

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos')
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

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    let dados = {
        departamento: omie_departamento,
        usuario: acesso.usuario,
        data: dt()
    }

    let input = document.getElementById(input_id)
    input.parentElement.id = omie_departamento // ID da td é o cod_departamento; 
    input.previousElementSibling.style.display = omie_departamento != '' ? 'block' : 'none'
    input.value = descricao
    input.nextElementSibling.textContent = acesso.usuario
    input.nextElementSibling.nextElementSibling.textContent = dt()

    colorir_tabela()

    tecnico.agendas[chave_da_agenda][dia] = dados
    await enviar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${chave_da_agenda}/${dia}`, dados)

    inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}

async function filtrar_por_regiao() {

    let campo_tecnico_pesquisa = String(document.getElementById('campo_tecnico_pesquisa').value).toLowerCase();
    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {};
    let tabela = document.querySelector('table');
    let tbody = tabela.querySelector('tbody');
    let trs = tbody.querySelectorAll('tr');

    let filtros_regioes = document.getElementById('filtros_regioes');
    let inputs = filtros_regioes.querySelectorAll('input');
    let regioes_ativas = JSON.parse(localStorage.getItem('regioes_ativas')) || [];

    inputs.forEach(input => {
        let regiao = input.nextElementSibling.textContent;
        input.checked = regioes_ativas.includes(regiao);
    });

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        let codigo_tecnico = tds[0].id;
        let regiao_do_tecnico = dados_agenda_tecnicos?.[codigo_tecnico]?.regiao_atual || '';
        let nome_tecnico = String(tds[0].querySelector('label').textContent).toLowerCase();

        let mostrar_linha =
            (regioes_ativas.length === 0 || regioes_ativas.includes(regiao_do_tecnico)) &&
            (campo_tecnico_pesquisa === '' || nome_tecnico.includes(campo_tecnico_pesquisa));

        tr.style.display = mostrar_linha ? 'table-row' : 'none';
    });
}

async function incluir_regiao(input) {
    let regiao = input.nextElementSibling.textContent;
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

async function abrir_detalhes(codigo_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    let atual = tecnico.regiao_atual
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let opcoes = `
        <option></option>
    `

    regioes.forEach(regiao => {
        opcoes += `
        <option  ${atual == regiao ? 'selected' : ''}>${regiao}</option>
        `
    })

    let acumulado = `
    <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; margin: 2vw; gap: 2vh;">
        <label>Região atual do Técnico</label>
        <select onchange="alterar_regiao(this, ${codigo_tecnico})" class="select_regiao">
            ${opcoes}
        </select>
    </div>
    <hr>
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <label>Apagar essa agenda?</label>
        <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;" onclick="confirmar_apagar_agenda('${codigo_tecnico}')">
    </div>

    ${acesso.permissao == 'adm' ?
            `<hr>
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <label>Apagar o técnico?</label>
        <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;" onclick="confirmar_apagar_tecnico('${codigo_tecnico}')">
    </div>
    ` : ''}`

    openPopup_v2(acumulado, 'Configurações')

}

async function confirmar_apagar_tecnico(omie_tecnico) {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_invertido = {}
    for (cnpj in dados_clientes) {
        let cliente = dados_clientes[cnpj]
        dados_clientes_invertido[cliente.omie] = cliente
    }

    openPopup_v2(`
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Apagar este técnico?</label>
            <label>${dados_clientes_invertido?.[omie_tecnico]?.nome || omie_tecnico}</label>
            <button style="background-color: #4CAF50;" onclick="apagar_tecnico('${omie_tecnico}')">Confirmar</button>
        </div>
        `, 'Aviso')

}

async function apagar_tecnico(omie_tecnico) {

    remover_popup()

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}

    delete dados_agenda_tecnicos[omie_tecnico]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}`)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    carregar_tabela()

}

async function alterar_regiao(select, codigo_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
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

            if (i > 2) {

                let input = td.querySelector('input')

                if (input.value != '') {

                    if (!departamentos[input.value]) {

                        let estilos = back_fonte()
                        departamentos[input.value] = {
                            bg: estilos.corFundo,
                            cor: estilos.corTexto
                        }
                    }

                    td.style.backgroundColor = departamentos[input.value].bg
                    input.style.color = departamentos[input.value].cor

                } else {
                    td.style.backgroundColor = ''
                    td.style.color = 'black'
                }

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

// Função para arrastar;
let segurando = false;
let celula_inicial = null;
let celulas_selecionadas = [];

document.addEventListener("mousedown", function (event) {
    if (event.target.tagName === "INPUT") {
        segurando = true;
        celula_inicial = event.target;
        celulas_selecionadas = [celula_inicial];

        celula_inicial.parentElement.classList.add('selecionado'); // Aplica-se ao TD...
    }
});

document.addEventListener("mousemove", function (event) {
    if (segurando && event.target.tagName === "INPUT") {
        let cell = event.target;
        if (!celulas_selecionadas.includes(cell)) {
            celulas_selecionadas.push(cell);
            cell.parentElement.classList.add('selecionado'); // TD
        }
    }
});

document.addEventListener("mouseup", function () {
    if (segurando) {
        let cod_departamento = celula_inicial?.parentElement.id;
        let nome_do_departamento = celula_inicial?.value;

        let celulas_para_atualizar = [...celulas_selecionadas];

        segurando = false;
        celulas_selecionadas = [];

        (async () => {
            for (let cell of celulas_para_atualizar) {
                await definir_campo(cell.id, cod_departamento, nome_do_departamento);
                cell.parentElement.classList.remove('selecionado'); // TD
            }
        })();
    }
});
