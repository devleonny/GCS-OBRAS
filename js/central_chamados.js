
const modelo = (valor1, valor2) => `
    <div style="${horizontal}; gap: 1rem; margin-bottom: 5px; width: 100%;">
        <label style="width: 30%; text-align: right;"><b>${valor1}</b></label>
        <div style="width: 70%; text-align: left;">${valor2}</div>
    </div>`

const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: start; gap: 5px;">
        <label><b>${valor1}:</b></label>
        <div style="text-align: justify;">${elemento}</div>
    </div>`

const botao = (texto, funcao, bgColor) => `<button style="background-color: ${bgColor}" onclick="${funcao}">${texto}</button>`

const botaoImg = (img, funcao) => `
    <div class="botaoImg">
        <img src="imagens/${img}.png" onclick="${funcao}">
    </div>`

const dtFormatada = (data) => {
    if (!data) return '-'
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
}

const modeloTabela = ({ minWidth, removerPesquisa = false, colunas, base, funcao, btnExtras = '', body = 'body' }) => {

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const tPesquisa = colunas
        .map((col, i) => `<th style="text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, '${body}')"></th>`)
        .join('')

    return `
    <div class="blocoTabela" ${minWidth ? `style="min-width: ${minWidth}"` : ''}>
        <div class="painelBotoes">
            <div class="botoes">
                ${btnExtras}
            </div>
        </div>
        <div class="recorteTabela">
            <table class="tabela" ${colunas.length == 2 ? 'style="width: 100%;"' : ''}>
                <thead>
                    <tr>${ths}</tr>
                    ${removerPesquisa ? '' : `<tr>${tPesquisa}</tr>`}
                </thead>
                <tbody id="${body}"></tbody>
            </table>
        </div>
        <div class="rodape-tabela"></div>
    </div>`
}

const mensagem = (mensagem, imagem) => `
    <div class="mensagem">
        <img src="${imagem || 'gifs/alerta.gif'}">
        <label>${mensagem}</label>
    </div>
    `
const btnRodape = (texto, funcao) => `
    <button class="btnRodape" onclick="${funcao}">${texto}</button>
`
const btnPadrao = (texto, funcao) => `
        <span class="btnPadrao" onclick="${funcao}">${texto}</span>
`
const btn = ({ img, nome, funcao, id, elemento }) => `
    <div class="btnLateral" ${id ? `id="${id}"` : ''} onclick="${funcao}">
        ${img ? `<img src="imagens/${img}.png">` : ''}
        ${elemento || ''}
        <div>${nome}</div>
    </div>
`

telaLogin()

function pesquisarGenerico(coluna, texto, tbody = 'body') {

    filtrosPagina[tbody] ??= {}
    filtrosPagina[tbody][coluna] = String(texto).toLowerCase().replace(/\./g, '').trim()

    const trs = document.querySelectorAll(`#${tbody} tr`)

    // pega todo o conteúdo útil da td (inputs, selects, textos)
    function extrairTexto(td) {
        let partes = []

        // pega textos diretos
        partes.push(td.textContent || '')

        // inputs
        td.querySelectorAll('input').forEach(inp => {
            partes.push(inp.value || '')
        })

        // textareas
        td.querySelectorAll('textarea').forEach(tx => {
            partes.push(tx.value || '')
        })

        // selects
        td.querySelectorAll('select').forEach(sel => {
            let opt = sel.options[sel.selectedIndex]
            partes.push(opt ? opt.text : sel.value)
        })

        // join e normaliza
        return partes.join(' ').replace(/\s+/g, ' ').trim()
    }

    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td')
        let mostrar = true

        const filtros = filtrosPagina[tbody]

        for (const [col, filtroTexto] of Object.entries(filtros)) {

            if (!filtroTexto) continue

            if (col >= tds.length) {
                mostrar = false
                break
            }

            const conteudoTd = extrairTexto(tds[col]).toLowerCase().replace(/\./g, '').trim()

            if (!conteudoTd.includes(filtroTexto)) {
                mostrar = false
                break
            }
        }

        tr.style.display = mostrar ? '' : 'none'
    })

}

function solicitarPermissoes() {
    return new Promise((resolve, reject) => {
        if (!(cordova.plugins && cordova.plugins.permissions)) {
            popup(mensagem('Plugin de permissões não está disponível. Algumas funcionalidades podem não funcionar.'), 'Aviso');
            return resolve();
        }

        const permissions = cordova.plugins.permissions;
        const androidVersion = (device && device.version) || '0';
        const lista = [
            permissions.CAMERA,
            permissions.ACCESS_FINE_LOCATION,
            permissions.ACCESS_COARSE_LOCATION,
            permissions.FOREGROUND_SERVICE,
            permissions.FOREGROUND_SERVICE_LOCATION,
            ...(cordova.platformId === 'android' && parseFloat(androidVersion) >= 13
                ? [permissions.POST_NOTIFICATIONS]
                : [])
        ];

        permissions.requestPermissions(lista, (status) => {
            if (!status || typeof status.hasPermission === 'undefined') {
                popup(mensagem(`Falha ao verificar permissões. Verifique as configurações do dispositivo.`), 'Aviso');
                return reject(new Error('Verificação de permissões falhou'));
            }

            resolve();
        }, (error) => {
            popup(mensagem(`Erro ao solicitar permissões: ${error}`), 'Erro');
            reject(error);
        });
    });
}

function exibirSenha(img) {

    const inputSenha = img.previousElementSibling
    const atual = inputSenha.type == 'password'
    inputSenha.type = atual ? 'text' : 'password'
    img.src = `imagens/${atual ? 'olhoAberto' : 'olhoFechado'}.png`

}

async function capturarLocalizacao() {
    return new Promise(resolve => {
        if (!('geolocation' in navigator)) {
            localStorage.setItem('geo_permitido', '0')
            return resolve(null)
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                localStorage.setItem('geo_permitido', '1')
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                })
            },
            () => {
                localStorage.setItem('geo_permitido', '0')
                resolve(null)
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        )
    })
}

function irGCS() {
    localStorage.setItem('app', 'GCS')
    window.location.href = 'index.html'
}

async function telaPrincipal() {

    bReset = 2 // ocorrências

    atribuirVariaveis()

    toolbar.style.display = 'flex'
    const planoFundo = `
        <div class="planoFundo">
            <img src="gifs/loading.gif" style="width: 8rem;">
        </div>`

    const acumulado = `
        <div class="menu-container">
            <div class="side-menu">
                <div class="progresso"></div>
                <div class="botoesMenu"></div>
            </div>
            <div class="telaInterna">
                ${planoFundo}
            </div>
        </div>
    `

    telaInterna = document.querySelector('.telaInterna')
    if (!telaInterna) tela.innerHTML = acumulado

    telaInterna = document.querySelector('.telaInterna')
    telaInterna.innerHTML = planoFundo

    mostrarMenus(false)

    await criarElementosIniciais()

}

async function criarElementosIniciais() {

    await telaOcorrencias(true) // Apenas para carregar o objeto listaOcorrencias;

    const totais = {}
    let atradados = 0

    for (const ocorrencia of Object.values(listaOcorrencias)) {

        if (ocorrencia.criador !== acesso.usuario) continue

        const { ultima_correcao, atrasado } = ocorrencia

        if (ultima_correcao == 'Solucionada') continue

        totais[ultima_correcao] ??= 0
        totais[ultima_correcao]++

        if (atrasado == 'Sim') atradados++

    }

    const pFundo = document.querySelector('.planoFundo')
    const m = (funcao, texto, total) => `
        <div class="pill" onclick="${funcao}">
            <span class="pill-a" style="background: #b12425;">${total}</span>
            <span class="pill-b">${texto}</span>
        </div>
    `

    if (!Object.keys(totais).length && !atradados.length) return pFundo.innerHTML = `<img src="imagens/BG.png">`

    const atalhoCorrecoes = Object.entries(totais)
        .map(([correcao, total]) => m(`atalhoPendencias('ultima_correcao', '${correcao}')`, correcao, total))
        .join('')

    const hora = new Date().getHours()
    const saudacao = hora > 18
        ? 'Boa noite'
        : hora > 12
            ? 'Boa tarde'
            : 'Bom dia'

    const dAtrasados = `
        <div class="b-atalhos">
            ${m(`atalhoPendencias('atrasado', 'Sim')`, 'Atrasados', atradados)}
        </div>
    `

    const dAtalhos = `
        <div class="b-atalhos">
            ${atalhoCorrecoes}
        </div>
    `

    pFundo.innerHTML = `
        <span style="padding: 1rem; font-size: 1rem; color: white;">
            <b>${saudacao}</b>,<br> logo abaixo veja alguns atalhos para ocorrências que precisam de atenção:
        </span>
        <div class="b-painel">
            ${Object.keys(totais).length ? dAtalhos : ''}
            ${atradados.length ? dAtrasados : ''}
        </div>
    `
}

function atalhoPendencias(campo, valor) {
    const nFiltro = { criador: acesso.usuario }
    nFiltro[campo] = valor
    localStorage.setItem('filtrosAtivos', JSON.stringify(nFiltro))

    filtrarPorCampo()
}

function carregarMenus() {

    const blq = ['cliente', 'técnico']

    const menus = {
        'Atualizar': { img: 'atualizar', funcao: 'atualizarOcorrencias()', proibidos: [] },
        'Início': { img: 'home', funcao: 'telaPrincipal()', proibidos: [] },
        'Criar Ocorrência': { img: 'baixar', funcao: 'formularioOcorrencia()', proibidos: [] },
        'Ocorrências': { img: 'configuracoes', funcao: 'telaOcorrencias()', proibidos: [] },
        'Relatório de Ocorrências': { img: 'planilha', funcao: 'telaRelatorio()', proibidos: ['user', 'técnico', 'visitante'] },
        'Relatório de Correções': { img: 'planilha', funcao: 'telaRelatorioCorrecoes()', proibidos: ['user', 'técnico', 'visitante'] },
        'Usuários': { img: 'perfil', funcao: 'telaUsuarios()', proibidos: ['user', 'cliente', 'técnico', 'analista', 'visitante'] },
        'Cadastros': { img: 'ajustar', funcao: 'telaCadastros()', proibidos: ['user', 'técnico', 'cliente', 'visitante'] },
    }

    if (!blq.includes(acesso.permissao)) {
        menus.GCS = { img: 'LG', funcao: 'irGCS()', proibidos: ['técnico', 'visitante'] }
    }

    menus.Desconectar = { img: 'sair', funcao: 'deslogarUsuario()', proibidos: [] }

    const stringMenus = Object.entries(menus)
        .filter(([_, dados]) => !dados.proibidos.includes(acesso.permissao))
        .map(([nome, dados]) => btn({ ...dados, nome }))
        .join('');
     
    const botoes = `
        <div class="nomeUsuario">
            <span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>
        </div>
        <br>
        <div class="painel-pendencias"></div>
        <br>
        ${stringMenus}

    `
    document.querySelector('.botoesMenu').innerHTML = botoes
}

async function telaUsuarios() {

    filtroOcorrencias = {}

    overlayAguarde()

    titulo.textContent = 'Gerenciar Usuários'

    mostrarMenus(false)

    empresas = await recuperarDados('empresas')
    const colunas = ['Nome', 'Empresa', 'Setor', 'Permissão', '']

    dados_setores = await recuperarDados('dados_setores')
    const btnExtras = `<img onclick="atualizarUsuarios()" src="imagens/atualizar.png">`

    const tbody = document.getElementById('tabela_usuarios')
    if (!tbody) telaInterna.innerHTML = modeloTabela({ btnExtras, colunas, body: 'tabela_usuarios' })

    for (const [user, dados] of Object.entries(dados_setores)) {
        criarLinhaUsuario(user, dados)
    }

    removerOverlay()

}

async function atualizarUsuarios() {

    await sincronizarDados('dados_setores')
    await sincronizarDados('empresas')
    await telaUsuarios()

}

function criarLinhaUsuario(user, dados) {

    const tds = `
        <td>${dados.nome_completo || '...'}</td>
        <td>${empresas?.[dados?.empresa]?.nome || '...'}</td>
        <td>${dados.setor || '...'}</td>
        <td>${dados.permissao || '...'}</td>
        <td><img onclick="gerenciarUsuario('${user}')" src="imagens/pesquisar2.png"></td>
    `

    const trExistente = document.getElementById(user)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('tabela_usuarios').insertAdjacentHTML('beforeend', `<tr id="${user}">${tds}</tr>`)
}

function popupNotificacao(msg) {

    const idNot = ID5digitos()
    const acumulado = `
        <div id="${idNot}" class="notificacao">${msg}</div>
    `

    document.body.insertAdjacentHTML('beforeend', acumulado)

    setTimeout(() => {
        document.getElementById(idNot).remove()
    }, 5000);

}

async function gerenciarUsuario(id) {

    const usuario = await recuperarDado('dados_setores', id)

    const empresasOpcoes = Object.entries({ '': { nome: '' }, ...empresas }).sort()
        .map(([id, empresa]) => `<option value="${id}" ${usuario?.empresa == id ? 'selected' : ''}>${empresa.nome}</option>`)
        .join('')

    const permissoes = ['novo', 'desativado', 'técnico', 'cliente']
        .map(op => `<option ${usuario?.permissao == op ? 'selected' : ''}>${op}</option>`).join('')

    const setores = ['', 'CHAMADOS', 'MATRIZ BA', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO']
        .map(op => `<option ${usuario?.setor == op ? 'selected' : ''}>${op}</option>`).join('')

    const linhas = [
        { texto: 'Nome', elemento: `<span>${usuario?.nome_completo || '-'}</span>` },
        { texto: 'E-mail', elemento: `<span>${usuario?.email || '-'}</span>` },
        { texto: 'Permissão', elemento: `<select onchange="configuracoes('${id}', 'permissao', this.value)">${permissoes}</select>` },
        { texto: 'Setor', elemento: `<select onchange="configuracoes('${id}', 'setor', this.value)">${setores}</select>` },
        { texto: 'Empresa', elemento: `<select onchange="configuracoes('${id}', 'empresa', this.value)">${empresasOpcoes}</select>` }
    ]

    const form = new formulario({ linhas, titulo: 'Gerenciar Usuário' })
    form.abrirFormulario()

}

function pesquisar(input) {
    const termo = input.value.trim().toLowerCase();
    const tbody = document.querySelector('.tabela tbody');
    const trs = tbody.querySelectorAll('tr');

    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        let encontrou = false;

        tds.forEach(td => {
            let texto = td.textContent.trim().toLowerCase();

            const inputInterno = td.querySelector('input, textarea, select');
            if (inputInterno) {
                texto += ' ' + inputInterno.value.trim().toLowerCase();
            }

            if (termo && texto.includes(termo)) {
                encontrou = true;
            }
        });

        if (!termo || encontrou) {
            tr.style.display = ''; // mostra
        } else {
            tr.style.display = 'none'; // oculta
        }
    });
}

function base64ToBlob(base64) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

async function importarAnexos({ input, foto }) {
    const formData = new FormData();

    if (foto) {
        const blob = base64ToBlob(foto);
        formData.append('arquivos', blob);
    } else {
        for (const file of input.files) {
            formData.append('arquivos', file);
        }
    }

    try {
        const response = await fetch(`${api}/upload`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (err) {
        popup(mensagem(`Erro na API: ${err}`));
        throw err;
    }
}
