let acesso = JSON.parse(localStorage.getItem('acesso'))
let dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
let versao = 'v3.0.5'

document.addEventListener('keydown', function (event) {
    if (event.key === 'F5') {
        f5()
    }
});

function f5() {
    location.reload();
}

// Provisório

localStorage.removeItem('technicians')
localStorage.removeItem('departments')
localStorage.removeItem('modulo_ativo')
localStorage.removeItem('current_settings')
localStorage.removeItem('dados_agenda_tecnicos')

identificacao_user()
async function identificacao_user() {

    if (acesso && document.title !== 'PDF') {

        if (Object.keys(dados_setores).length == 0) {
            dados_setores = await lista_setores()
            localStorage.setItem('dados_setores', JSON.stringify(dados_setores))
        }

        let permissao = dados_setores[acesso.usuario].permissao
        var texto = `
            <div style="position: relative; display: fixed;">
                <label onclick="deseja_sair()"
                style="cursor: pointer; position: absolute; top: 10px; right: 10px; color: white; font-family: 'Poppins', sans-serif;">${acesso.usuario} • ${permissao} • Desconectar • ${versao}</label>
            </div>
        `
        document.body.insertAdjacentHTML('beforebegin', texto)
    }

}

function verificar_timestamp_nome(nome) {
    let regex = /^(\d{13})\.\w+$/;
    let match = nome.match(regex);

    if (match) {
        let timestamp = parseInt(match[1]);
        let data = new Date(timestamp);
        return !isNaN(data.getTime()) && data.getFullYear() > 2000;
    }

    return false;
}

function abrirArquivo(link) {

    if (verificar_timestamp_nome(link)) { // Se for um link composto por timestamp, então vem do servidor;
        link = `https://leonny.dev.br/uploads/${link}`
    } else { // Antigo Google;
        link = `https://drive.google.com/file/d/${link}/view?usp=drivesdk`
    }

    try {
        shell.openExternal(link);
    } catch {
        window.open(link, '_blank');
    }
}

function deseja_sair() {
    openPopup_v2(`
        <button onclick="sair()" style="background-color: green">Confirmar</button>
        `, 'Deseja Sair?')
}

function inicial_maiuscula(string) {
    if (string == undefined) {
        return ''
    }
    string.includes('_') ? string = string.split('_').join(' ') : ''
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function overlay_aguarde() {

    let elemento = `           
    <div id="aguarde" style="display: flex; 
                align-items: center; 
                justify-content: center; 
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                font-size: 1.5em;
                border-radius: 3px;
            ">
        <img src="gifs/loading.gif" style="width: 5vw;">
    </div>
    `
    return elemento
}

setInterval(async function () {
    await reprocessar_offline()
}, 60000)

async function reprocessar_offline() {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};

    for (let operacao in dados_offline) {
        let operacoes = dados_offline[operacao];

        for (let id in operacoes) {
            let evento = operacoes[id];

            if (operacao === 'enviar') {
                await enviar(evento.caminho, evento.valor);
            } else {
                await deletar(evento.chave);
            }

            dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};
            delete dados_offline[operacao][id];
            localStorage.setItem('dados_offline', JSON.stringify(dados_offline));

        }
    }
}


function inserirDados(dados, nome_da_base) {
    const request = indexedDB.open('Bases');
    let novaVersao;

    nome_da_base = `${nome_da_base}_clone`

    request.onsuccess = function (event) {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(nome_da_base)) {
            novaVersao = db.version + 1;
            db.close();

            const upgradeRequest = indexedDB.open('Bases', novaVersao);

            upgradeRequest.onupgradeneeded = function (event) {
                const upgradedDB = event.target.result;
                upgradedDB.createObjectStore(nome_da_base, { keyPath: 'id' });
                console.log(`Store "${nome_da_base}" criada com sucesso.`);
            };

            upgradeRequest.onsuccess = function (event) {
                const upgradedDB = event.target.result;
                executarTransacao(upgradedDB, nome_da_base, dados);
            };

            upgradeRequest.onerror = function (event) {
                console.error('Erro ao atualizar versão do banco:', event.target.error);
            };
        } else {
            executarTransacao(db, nome_da_base, dados);
        }
    };

    request.onerror = function (event) {
        console.error('Erro ao abrir o banco de dados:', event.target.error);
    };
}

function executarTransacao(db, nome_da_base, dados) {

    if (!dados) {
        return
    }

    const transaction = db.transaction([nome_da_base], 'readwrite');
    const store = transaction.objectStore(nome_da_base);

    const clearRequest = store.clear();

    clearRequest.onsuccess = function () {
        if (Array.isArray(dados)) {
            dados.forEach(item => {
                item.id = 1;
                const addRequest = store.put(item);
                addRequest.onerror = function (event) {
                    console.error('Erro ao adicionar item:', event.target.error);
                };
            });
        } else {
            dados.id = 1;
            const addRequest = store.put(dados);
            addRequest.onerror = function (event) {
                console.error('Erro ao adicionar item:', event.target.error);
            };
        }
    };

    clearRequest.onerror = function (event) {
        console.error('Erro ao limpar os registros anteriores:', event.target.error);
    };

    transaction.onerror = function (event) {
        console.error('Erro durante a transação:', event.target.errorCode);
    };

}

async function recuperarDados(nome_da_base) {
    return new Promise((resolve, reject) => {

        nome_da_base = `${nome_da_base}_clone`

        const request = indexedDB.open('Bases');

        request.onsuccess = function (event) {
            const db = event.target.result;

            // Verificar se a store existe;
            if (!db.objectStoreNames.contains(nome_da_base)) {
                resolve(null);
                return;
            }

            const transaction = db.transaction([nome_da_base], 'readonly');
            const store = transaction.objectStore(nome_da_base);

            const getRequest = store.get(1);

            getRequest.onsuccess = function (event) {
                let dados = event.target.result

                if (dados && dados['id']) {
                    delete dados['id']
                }

                resolve(event.target.result || null);
            };

            getRequest.onerror = function (event) {
                reject(event.target.error);
            };
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

function openPopup_v2(elementoHTML, titulo, nao_remover_anteriores) {

    let popup_v2 = `
    <div id="temp_pop" style="
    position: fixed;
    z-index: 2000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.7);">

        <div class="janela_fora">
            
            <div style="background-color: transparent; width: 100%; display: flex; justify-content: center; align-items: center;">
                <div class="botao_popup" style="pointer-events: none; width: 100%; display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 5px;">
                    <label style="margin-left: 1vw; margin-right: 3vw; color: white;">${titulo || 'GCS'}</label>
                </div>
                <div style="display: flex; align-items: center; justify-content: center;">

                    <div class="botao_popup" onclick="ajustar_janela(false)">
                        <label>_</label>
                    </div>
                    <div class="botao_popup" onclick="ajustar_janela(true)">
                        <img src="imagens/max.png">
                    </div>
                    <div class="botao_popup" style="border-top-right-radius: 5px; background-color: #b12425;" onclick="remover_popup()">
                        <label>×</label>
                    </div>

                </div>
            </div>
            
            <div class="janela">

                ${elementoHTML}

            </div>

        </div>

    </div>
    `;

    remover_popup(nao_remover_anteriores)

    document.body.insertAdjacentHTML('beforeend', popup_v2);

}

function criarAnexoVisual(nome, link_anexo, funcao_excluir) {

    let displayExcluir = 'flex'

    if (!funcao_excluir) {

        displayExcluir = 'none'

    }

    // Formata o nome para exibição curta
    const nomeFormatado = nome.length > 15
        ? `${nome.slice(0, 6)}...${nome.slice(-6)}`
        : nome;

    return `
        <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
            <div onclick="abrirArquivo('${link_anexo}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 15vw;">
                <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                <label style="cursor: pointer;" title="${nome}">${nomeFormatado}</label>
            </div>
            <button style="display: ${displayExcluir};" class="botao-excluir-anexo" onclick="${funcao_excluir}">
                <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="${funcao_excluir}">
            </button>
        </div>
    `;
}


let janela_original = { width: '', height: '', maxWidth: '', maxHeight: '' };
let janela_original_simples = { width: '', height: '', maxWidth: '', maxHeight: '' };
let maximizado = false;

function ajustar_janela(ampliar) {
    let janela_fora = document.querySelectorAll('.janela_fora')
    let janela = document.querySelectorAll('.janela')

    janela_fora = janela_fora[janela_fora.length - 1]
    janela = janela[janela.length - 1]

    if (!janela_fora || !janela) return;

    if (ampliar) {
        if (!maximizado) {
            // Salvar tamanhos originais da janela principal
            let estilosFora = getComputedStyle(janela_fora);
            janela_original.width = estilosFora.width;
            janela_original.height = estilosFora.height;
            janela_original.maxWidth = estilosFora.maxWidth;
            janela_original.maxHeight = estilosFora.maxHeight;

            // Salvar tamanhos originais da janela simples
            let estilosJanela = getComputedStyle(janela);
            janela_original_simples.width = estilosJanela.width;
            janela_original_simples.height = estilosJanela.height;
            janela_original_simples.maxWidth = estilosJanela.maxWidth;
            janela_original_simples.maxHeight = estilosJanela.maxHeight;
        }

        // Maximizar
        janela_fora.style.width = '100vw';
        janela_fora.style.maxWidth = '100vw';
        janela_fora.style.height = '98vh';
        janela_fora.style.maxHeight = '100vh';

        janela.style.width = '100%';
        janela.style.height = '100vh';
        janela.style.maxHeight = '100vh';

        maximizado = true;
    } else {
        // Restaurar tamanhos originais
        janela_fora.style.width = janela_original.width;
        janela_fora.style.maxWidth = janela_original.maxWidth;
        janela_fora.style.height = janela_original.height;
        janela_fora.style.maxHeight = janela_original.maxHeight;

        janela.style.width = janela_original_simples.width;
        janela.style.height = janela_original_simples.height;
        janela.style.maxWidth = janela_original_simples.maxWidth;
        janela.style.maxHeight = janela_original_simples.maxHeight;

        maximizado = false;
    }
}

function dicionario(item) {
    return typeof item === "object" && item !== null && item.constructor === Object;
}

function mostrar_ocultar_alertas() {
    var alertas_div = document.getElementById('alertas_div')
    var icone_alerta = document.getElementById('icone_alerta')

    if (alertas_div && icone_alerta) {
        alertas_div.classList.toggle('show');

        if (icone_alerta.style.display == 'flex') {
            icone_alerta.style.display = 'none'
            if (overlay) {
                overlay.style.display = 'block'
            }
        } else {
            remover_popup()
            icone_alerta.style.display = 'flex'
        }

    }
}

function para_excel(tabela_id) {
    const tabelaOriginal = document.getElementById(tabela_id);
    if (!tabelaOriginal) return;

    const tabelaClone = tabelaOriginal.cloneNode(true);

    const inputs = tabelaClone.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        const cell = input.closest('td, th');
        if (cell) {
            cell.textContent = input.value;
        }
    });

    const worksheet = XLSX.utils.table_to_sheet(tabelaClone);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planilha1");
    XLSX.writeFile(workbook, 'dados.xlsx');
}

async function remover_popup(nao_remover_anteriores) {

    let pop_ups = document.querySelectorAll('#temp_pop')

    if (nao_remover_anteriores) {
        return
    }

    if (pop_ups.length > 1) {
        pop_ups[pop_ups.length - 1].remove()

    } else {
        pop_ups.forEach(pop => {
            pop.remove()
        })
    }

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }

}

function sair() {
    localStorage.removeItem('acesso')
    window.location.href = 'login.html'
}

function unicoID() {
    var d = new Date().getTime();
    if (window.performance && typeof window.performance.now === "function") {
        d += performance.now();
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

function ampliar(url) {
    var div = document.getElementById('imagem_upload');
    document.getElementById('img').src = url
    div.classList.toggle('show');
}

function conversor(stringMonetario) {
    if (typeof stringMonetario === 'number') {
        return stringMonetario;
    } else if (!stringMonetario || stringMonetario.trim() === "") {
        return 0;
    } else {
        stringMonetario = stringMonetario.trim();
        stringMonetario = stringMonetario.replace(/[^\d.,]/g, '');

        if (stringMonetario.includes(',') && stringMonetario.includes('.')) {
            stringMonetario = stringMonetario.replace(/\./g, '');
            stringMonetario = stringMonetario.replace(',', '.');
        } else {
            stringMonetario = stringMonetario.replace(',', '.');
        }

        var valorNumerico = parseFloat(stringMonetario);

        if (isNaN(valorNumerico)) {
            return 0;
        }

        return valorNumerico;
    }
}

function dinheiro(valor) {
    if (valor === '') {
        return 'R$ 0,00';
    } else {
        valor = Number(valor);
        return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

function ir_para(modulo) {

    localStorage.setItem('modulo_ativo', modulo)

    window.location.href = 'orcamentos.html'

}

function fecharPopup() {
    var popup = document.getElementById('popup');
    popup.classList.remove('aberto');
}

async function ir_pdf(orcam_) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    localStorage.setItem('pdf', JSON.stringify(dados_orcamentos[orcam_]));

    try {
        const { ipcRenderer } = require('electron');
        const pdfUrl = `clone/pdf.html`;
        ipcRenderer.invoke('open-new-window', pdfUrl);

    } catch {
        window.location.href = `pdf.html`;
    }
}

function criar_orcamento_janela() {

    const { ipcRenderer } = require('electron');

    //novo 28/08/2024;
    ipcRenderer.invoke('open-new-window', 'criar_orcamento.html');
    //window.location.href = ('pdf.html');
}

function removerLinha(select) {
    var linha = select.closest('tr');
    linha.parentNode.removeChild(linha);
}

async function apagar(codigo_orcamento) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    if (dados_orcamentos[codigo_orcamento]) {
        delete dados_orcamentos[codigo_orcamento]
        await inserirDados(dados_orcamentos, 'dados_orcamentos')
        deletar(`dados_orcamentos/${codigo_orcamento}`)
    }
    await preencher_orcamentos_v2()
    remover_popup()
}

function formatodata(data) {

    var partes = data.split('/');
    var dia = partes[0];
    var mes = partes[1];
    var ano = partes[2];
    return `${ano}-${mes}-${dia}`;
}

function fechar_popup_composicoes() {
    document.getElementById('retangulo_glass').style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

function fechar_popup_logistica() {
    document.getElementById('retangulo_logistica').style.display = 'none'
}

function timestamp(dataStr, horaStr) {
    const [dia, mes, ano] = dataStr.split('/').map(Number);
    const [hora, minuto, segundo] = horaStr.split(':').map(Number);

    const data = new Date(ano, mes - 1, dia, hora, minuto, segundo);
    return data.getTime();
}

async function recuperar_clientes() {

    var acompanhamento_dados_clientes = document.getElementById('acompanhamento_dados_clientes')
    if (acompanhamento_dados_clientes) {
        acompanhamento_dados_clientes.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: left;">
            <img src="gifs/loading.gif" style="width: 50px">
            <label>Aguarde alguns segundos... </label>
        </div>
        `
    }

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let timestamps = {
        alteracao: [],
        inclusao: []
    }

    for (cnpj in dados_clientes) {
        let cliente = dados_clientes[cnpj]
        if (cliente.alteracao) {
            timestamps.alteracao.push(cliente.alteracao)
        }

        if (cliente.inclusao) {
            timestamps.inclusao.push(cliente.inclusao)
        }

    }

    // Verificar os maiores timestamps em cada lista;
    let resultado = {};
    for (let chave in timestamps) {
        if (timestamps[chave].length > 0) {
            let maior = timestamps[chave].reduce((max, item) =>
                item.timestamp > max.timestamp ? item : max
            );
            resultado[chave] = maior;
        }
    }

    if (Object.keys(resultado).length == 0) { // Caso seja a primeira vez de execução;
        resultado = {
            inclusao: {
                data: '01/01/2000',
                hora: '00:00:00'
            }
        }
    }

    let clientes = {};
    for (modalidade in resultado) {

        let data = resultado[modalidade].data
        let hora = resultado[modalidade].hora
        let objeto = await dados_clientes_por_pagina(1, data, hora, modalidade);

        if (objeto.faultstring) {
            return console.log(objeto)
        }

        alimentar_objeto(objeto);

        for (let i = 2; i <= objeto.total_de_paginas; i++) {
            objeto = await dados_clientes_por_pagina(i, data, hora, modalidade);
            alimentar_objeto(objeto);
        }

        function alimentar_objeto(dados) {
            dados.clientes_cadastro.forEach((item) => {
                clientes[item.cnpj_cpf] = {
                    inativo: item.inativo,
                    nome: item.nome_fantasia,
                    cnpj: item.cnpj_cpf,
                    cep: item.cep,
                    cidade: item.cidade,
                    bairro: item.endereco,
                    estado: item.estado,
                    omie: item.codigo_cliente_omie,
                    tags: item.tags,
                    inclusao: {
                        timestamp: timestamp(item.info.dInc, item.info.hInc),
                        data: item.info.dInc,
                        hora: item.info.hInc
                    },
                    alteracao: {
                        timestamp: timestamp(item.info.dAlt, item.info.hAlt),
                        data: item.info.dAlt,
                        hora: item.info.hAlt
                    }
                };
            });
        }

    }

    for (cnpj in clientes) {

        let cliente = clientes[cnpj]

        if (cliente.inativo == 'S' && dados_clientes[cnpj]) {
            delete dados_clientes[cnpj]
        } else {
            dados_clientes[cnpj] = cliente
        }

    }

    await inserirDados(dados_clientes, 'dados_clientes')

    if (acompanhamento_dados_clientes) {
        dados_clientes_provisorios = data
        carregar_datalist_clientes()
        acompanhamento_dados_clientes.innerHTML = `
            <img src="imagens/omie.png">
            <label style="cursor: pointer;">Atualizar OMIE Clientes</label>
            `
    }

}

async function dados_clientes_por_pagina(pagina, data, hora, modalidade) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                pagina: pagina,
                data: data,
                hora: hora,
                modalidade: modalidade
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Erro na requisição: " + response.status);
                }
                return response.json();
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                console.error("Erro:", error);
                reject({});
            });
    });
}

async function recuperar() {

    return new Promise((resolve, reject) => {
        var requisicoes = {
            'vendedores': 'vendedores'
        }

        var alicia_keys = Object.keys(requisicoes);
        var promises = alicia_keys.map(function (api) {
            let url = `https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=${api}`;

            return fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erro ao carregar os dados');
                    }
                    return response.json();
                })
                .then(data => {
                    localStorage.setItem(requisicoes[api], JSON.stringify(data));
                });
        });

        Promise.all(promises)
            .then(() => {
                resolve();
            })
            .catch(error => {
                console.error('Ocorreu um erro:', error);
                reject(error);
            });
    });
}

function formatartextoHtml(texto) {
    return texto.replace(/\n/g, '<br>');
}

function baixar_em_excel(nome_tabela, filename) {

    var table = document.getElementById(nome_tabela)

    var wb = XLSX.utils.table_to_book(table, { sheet: "GCS" });

    filename = filename ? filename + '.xlsx' : 'excel_data.xlsx';

    XLSX.writeFile(wb, filename);
}

async function lista_setores(usuario) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/setores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

function fecharTabela(nome_tabela) {
    document.getElementById(nome_tabela).style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

if (document.title == 'Criar Orçamento') {
    calculadora_reversa()

    valor_liquido.addEventListener('input', function () {
        calcular()
    })

    icms_toggle.addEventListener('input', function () {
        calcular()
    })
}

function calcular() {
    var valor = Number(valor_liquido.value)

    var porcentagem = 0
    icms_toggle.checked == true ? porcentagem = 0.12 : porcentagem = 0.205

    var resultado = valor * 1 / (1 - porcentagem)

    valor_com_imposto.textContent = dinheiro(resultado)
}

function exibir_calculadora() {
    calculadora.classList.toggle('show');
}

function calculadora_reversa() {

    var calculadora = ''

    calculadora += `
    <div id="calculadora">
        <div style="display: grid;">
            <label>Valor Líquido</label>
            <input type="number" id="valor_liquido">
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <label>Dentro <strong>20,5%</strong></label>
            <label class="switch">
                <input type="checkbox" id="icms_toggle">
                <span class="slider"></span>
            </label>
        <label>Fora <strong>12%</strong></label>
        </div>

        <img src="imagens/avanco.png">
        <div style="display: grid;">
            <label>Valor Bruto</label>
            <label id="valor_com_imposto">R$ -- </label>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', calculadora);
}

function gerar_id_5_digitos() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        id += caracteres.charAt(indiceAleatorio);
    }
    return id;
}

function pesquisar_generico(coluna, texto, filtro, id) {

    filtro[coluna] = texto.toLowerCase();

    var tabela_itens = document.getElementById(id);
    var trs = tabela_itens.querySelectorAll('tr');
    let contador = 0

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');

        var mostrarLinha = true;

        for (var col in filtro) {
            var filtroTexto = filtro[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase()

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        mostrarLinha ? contador++ : ''

        tr.style.display = mostrarLinha ? '' : 'none';
    });

    let contagem = document.getElementById('contagem')
    if (contagem) {
        contagem.textContent = contador
    }

}

function carregamento(local) {
    var local_elemento = document.getElementById(local)

    local_elemento.innerHTML = '';

    var elemento = `
    <div id="carregamento" style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 10px;">
        <img src="gifs/loading.gif" style="width: 5vw">
        <label style="color: white; font-size: 1.5em;">Aguarde...</label>
    </div>
    `
    local_elemento.insertAdjacentHTML('beforeend', elemento)
}

function encurtar_texto(texto, limite) {

    texto = String(texto)
    if (texto.length > limite) {
        return texto.slice(0, limite) + "...";
    }
    return texto;
}

function enviar_dados_generico(dados) {

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}

async function salvar_levantamento(id_orcamento) {
    let elemento = document.getElementById("adicionar_levantamento");

    if (!elemento || !elemento.files || elemento.files.length === 0) {
        return;
    }

    try {
        let anexos = await anexo_v2(elemento); // Nova função de upload

        let anexo_dados = {};
        anexos.forEach(anexo => {
            let id_anexo = gerar_id_5_digitos();
            anexo_dados[id_anexo] = anexo;
        });

        if (id_orcamento) {
            let dados_orcamentos = await recuperarDados("dados_orcamentos") || {};
            let orcamento_v2 = dados_orcamentos[id_orcamento] || {};

            if (!orcamento_v2.levantamentos) {
                orcamento_v2.levantamentos = {};
            }

            Object.assign(orcamento_v2.levantamentos, anexo_dados);

            await inserirDados(dados_orcamentos, "dados_orcamentos");

            for (let id_anexo in anexo_dados) {
                await enviar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`, anexo_dados[id_anexo]);
            }

            abrir_esquema(id_orcamento);
        } else {
            let orcamento_v2 = JSON.parse(localStorage.getItem("orcamento_v2")) || {};

            if (!orcamento_v2.levantamentos) {
                orcamento_v2.levantamentos = {};
            }

            Object.assign(orcamento_v2.levantamentos, anexo_dados);

            localStorage.setItem("orcamento_v2", JSON.stringify(orcamento_v2));
            recuperar_preenchido();
        }
    } catch (error) {
        openPopup_v2(`Erro ao fazer upload: ${error.message}`);
        console.error(error);
    }
}

async function excluir_levantamento(id_orcamento, id_anexo) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcamento]
    delete orcamento.levantamentos[id_anexo]

    await deletar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    abrir_esquema(id_orcamento)

}

async function recuperar_dados_composicoes() {

    inserirDados(await receber('dados_composicoes'), 'dados_composicoes');

}

async function recuperar_estoque() {

    if (document.getElementById('tela')) {

        document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

        let estoque_nuvem = await receber('dados_estoque') || {}
        await inserirDados(estoque_nuvem, 'dados_estoque')

        let aguarde = document.getElementById('aguarde')
        if (aguarde) {
            aguarde.remove()
        }

    }

}

function filtrar_tabela(coluna, id, elementoTH) {

    let tabela = document.getElementById(id)
    let linhas = Array.from(tabela.tBodies[0].rows)
    let ascendente = tabela.getAttribute("data-order") !== "asc";

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna])
        let valorB = capturarValorCelula(b.cells[coluna])

        if (!isNaN(valorA) && !isNaN(valorB)) {
            return ascendente ? valorA - valorB : valorB - valorA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    });

    let tbody = tabela.tBodies[0];
    linhas.forEach((linha) => tbody.appendChild(linha))

    tabela.setAttribute("data-order", ascendente ? "asc" : "desc")

    let simbolo = ascendente ? 'a.png' : 'z.png'

    let tr = elementoTH.closest('tr')
    let ths = tr.querySelectorAll('th')

    ths.forEach(th => {
        let img = th.querySelector('img')
        if (img) {
            img.remove()
        }
    })

    elementoTH.insertAdjacentHTML('beforeend', `<img src="imagens/${simbolo}" style="border-radius: 3px; position: absolute; top: 3px; right: 3px; width: 20px; background-color: #d2d2d2;">`)
}

function capturarValorCelula(celula) {
    let entrada = celula.querySelector('input') || celula.querySelector('textarea');
    if (entrada) {
        return entrada.value.toLowerCase();
    }

    let valor = celula.innerText.toLowerCase();

    // 🔥 Exceção para valores monetários no formato "R$ 0,00"
    if (/^r\$\s[\d.,]+$/.test(valor)) {
        // Remove "R$", remove separadores de milhar, substitui vírgula por ponto e converte para número
        valor = valor.replace("r$", "").trim().replace(/\./g, "").replace(",", ".");
        return parseFloat(valor);
    }

    return valor;
}

//--- NOVO SERVIÇO DE ARMAZENAMENTO ---\\
async function receber(chave) {
    const url = `https://leonny.dev.br/dados?chave=${chave}&app=clone`;

    let obs = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    };

    try {
        const response = await fetch(url, obs);

        if (!response.ok) {
            throw new Error(`Erro: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        return {};
    }
}

async function deletar(chave) {
    const url = `https://leonny.dev.br/deletar`;
    return new Promise((resolve) => {
        fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ chave, app: 'clone' })
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(() => {
                salvar_offline({ chave: chave, app: 'clone' }, 'deletar')
                resolve();
            });
    });
}

function enviar(caminho, info) {
    return new Promise((resolve) => {
        let objeto = {
            caminho: caminho,
            valor: info,
            app: 'clone'
        };

        fetch("https://leonny.dev.br/salvar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(text => text ? JSON.parse(text) : {})
            .then(data => resolve(data))
            .catch((erro) => {
                console.error("Erro ao enviar:", erro);
                salvar_offline(objeto, 'enviar');
                resolve();
            });
    });
}

function salvar_offline(objeto, operacao) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    let id = gerar_id_5_digitos()

    if (!dados_offline[operacao]) {
        dados_offline[operacao] = {}
    }

    dados_offline[operacao][id] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

function dt() {
    let dt = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    })

    return dt
}

const WS_URL = "wss://leonny.dev.br:8443";
let socket;
let reconnectInterval = 30000;
connectWebSocket();

function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log(`🟢🟢🟢 WS ${dt()} 🟢🟢🟢`);
    };

    socket.onmessage = (event) => {
        let data = JSON.parse(event.data);
        espelhar_atualizacao(data);
        console.log('📢', data);
    };

    socket.onclose = () => {
        console.log(`🔴🔴🔴 WS ${dt()} 🔴🔴🔴`);
        console.log(`Tentando reconectar em ${reconnectInterval / 1000} segundos...`);
        setTimeout(connectWebSocket, reconnectInterval);
    };

    socket.onerror = (error) => {
        console.error("Erro no WebSocket:", error);
    };
}

async function espelhar_atualizacao(objeto) {
    if (!objeto.caminho && !objeto.chave) return;

    let chaves = objeto.caminho ? objeto.caminho.split("/") : objeto.chave.split("/");
    let arquivo = chaves.shift();
    let dados = await recuperarDados(arquivo);

    if (objeto.tipo === "remocao") {
        let deleteNestedValue = (obj, path) => {
            const keys = path.split('/');
            let current = obj;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current || !current[keys[i]]) return false;
                current = current[keys[i]];
            }

            const lastKey = keys[keys.length - 1];
            if (current.hasOwnProperty(lastKey)) {
                delete current[lastKey];
                return true;
            }

            return false;
        };

        let removido = deleteNestedValue(dados, chaves.join("/"));
        if (!removido) return;
    } else {
        let atualizarValor = (dados, chaves, valor) => {
            if (chaves.length === 0)
                return;
            let chaveAtual = chaves[0];

            // se a chave não existir ou for null, inicializar a chave como um objeto vazio
            if (dados[chaveAtual] === null || dados[chaveAtual] === undefined) {
                dados[chaveAtual] = {};
            }

            if (chaves.length === 1) {
                dados[chaveAtual] = valor;
            } else {
                atualizarValor(dados[chaveAtual], chaves.slice(1), valor);
            }
        };
    }

    await inserirDados(dados, arquivo);

    if (arquivo === "dados_kanban" && document.title === "KANBAN") {
        // carregarListas()
    }

    if (arquivo == 'aprovacoes') {
        aprovacoes_pendentes()
    }

}

async function gerar_pdf_online(htmlString, nome) {
    return new Promise((resolve, reject) => {
        let encoded = new TextEncoder().encode(htmlString);
        let compressed = pako.gzip(encoded);

        fetch("https://leonny.dev.br/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: compressed
        })
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `${nome}.pdf`;
                link.click();
                resolve()
            })
            .catch(err => {
                console.error("Erro ao gerar PDF:", err)
                reject()
            });
    })

}

async function refazer_pagamento(id_pagamento) {

    openPopup_v2(`
        <div style="margin: 1vw; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <img src="gifs/loading.gif" style="width: 5vw;">
            <label>Aguarde...</label>
        </div>
        `, 'Aviso', true)

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    if (lista_pagamentos[id_pagamento]) {
        remover_popup()
        let pagamento = lista_pagamentos[id_pagamento]
        console.log(await lancar_pagamento(pagamento))
        pagamento.status = 'Pagamento salvo localmente'
        await inserirDados(lista_pagamentos, 'lista_pagamentos')
        await abrir_detalhes(id_pagamento)
    } else {
        openPopup_v2(`
            <div style="margin: 1vw;">
                <label>Atualize os pagamentos e tente novamente.</label>
            </div>
            `, 'Aviso', true)
    }

}

async function lancar_pagamento(pagamento) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/lancar_pagamento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pagamento)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error("Erro ao gerar PDF:", err)
                reject()
            });
    })
}

function formatarData(dataISO) {
    if (!dataISO) return "--"; // Retorna um placeholder caso a data seja inválida ou vazia

    let partes = dataISO.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`; // Converte "YYYY-MM-DD" para "DD/MM/YYYY"
    }
    return dataISO; // Retorna a data original caso não esteja no formato esperado
}

async function anexo_v2(arquivoInput) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();

        for (let i = 0; i < arquivoInput.files.length; i++) {
            formData.append('arquivos', arquivoInput.files[i]);
        }

        fetch('https://leonny.dev.br/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                openPopup_v2(`
                    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
                        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                        <label>🔴🔴🔴 O serviço de armazenamentos está Offline 🔴🔴🔴</label> <br>
                        <label>Fale com um administrador para reiniciar o serviço</label>
                    </div>
                    `)
                reject();
            });
    });
}

function sincronizar(script) {

    fetch('https://leonny.dev.br/sincronizar', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script })
    })
        .then(response => response.text())
        .then(data => {
            console.log(JSON.parse(data));
        })
        .catch(error => console.error('Erro na requisição:', error));

}

function data_atual(estilo, nivel) {
    var dataAtual = new Date();

    if (nivel) {
        // var dataAtual = new Date(2024, 10, 10, 10, 0, 0, 0);
        var diaDeHoje = dataAtual.getDate();
        var ano = dataAtual.getFullYear();
        var mes = dataAtual.getMonth();

        if (nivel == 2 && diaDeHoje > 5) { // Pagamento de Parceiro no dia 10 do mês seguinte;
            diaDeHoje = 10;
            mes += 1;
        } else if (nivel == 2) { // Pagamento de Parceiro no dia 10;
            diaDeHoje = 10;
        } else if (nivel == 1) { // Adiantamento de Parceiro (8 dias prévios);
            diaDeHoje += 8;

            var diasNoMes = new Date(ano, mes + 1, 0).getDate();
            if (diaDeHoje > diasNoMes) {
                diaDeHoje -= diasNoMes;
                mes += 1;
            }
        }

        if (mes > 11) {
            mes = 0;
            ano += 1;
        }

        dataAtual = new Date(ano, mes, diaDeHoje);

        if (dataAtual.getDay() === 6) {
            dataAtual.setDate(dataAtual.getDate() + 2);
        } else if (dataAtual.getDay() === 0) {
            dataAtual.setDate(dataAtual.getDate() + 1);
        }

    }

    if (dataAtual.getDay() === 5 && dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 3);
    } else if (dataAtual.getDay() === 6) {
        dataAtual.setDate(dataAtual.getDate() + 2);
    } else if (dataAtual.getDay() === 0) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    } else if (dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    if (estilo === 'completa') {
        var dataFormatada = new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return dataFormatada;
    } else if (estilo === 'curta') {
        return dataAtual.toLocaleDateString('pt-BR');
    }
}

aprovacoes_pendentes()
async function aprovacoes_pendentes() {

    let painel_aprovacoes = document.getElementById('painel_aprovacoes')
    if (painel_aprovacoes) {
        painel_aprovacoes.remove()
    }

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    let aprovacoes = await receber('aprovacoes') || {}
    let acumulado = ''

    for (id in aprovacoes) {
        let item = aprovacoes[id]

        if (item.aprovacao && item.aprovacao.status) {

            if (orcamento_v2.aprovacao && orcamento_v2.aprovacao.id == id) {
                orcamento_v2.aprovacao.status = item.aprovacao.status
                orcamento_v2.aprovacao.justificativa = item.aprovacao.justificativa
                localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

                let aguardando_aprovacao = document.getElementById('aguardando_aprovacao')
                if (aguardando_aprovacao) {
                    await enviar_dados()
                }
            }

            continue
        }

        acumulado += `
            <div style="width: 30vw; background-color: #d2d2d2; color: #222; border-radius: 3px; padding: 5px; display: flex; justify-content: start; align-items: start; flex-direction: column;">
                <label>Autorização de Desconto</label>
                <hr style="width: 100%">    
                
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <label style="font-size: 1.5vw;">Total Sem Desconto</label>
                    <label>${item.total_sem_desconto}</label>
                </div>

                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <label style="font-size: 1.5vw;">Total Final</label>
                    <label>${item.total_geral}</label>
                </div>

                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <label style="font-size: 1.5vw;">Desconto em Dinheiro</label>
                    <label>${item.desconto_dinheiro}</label>
                </div>

                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <label style="font-size: 1.5vw;">Desconto Percentual</label>
                    <label>${Number(item.desconto_porcentagem)}%</label>
                </div>

                <hr style="width: 100%;">
                <div style="width: 100%; position: relative; color: #222; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">
                    <label>Justificativa</label>
                    <textarea rows="5" style="background-color: white; border: none; width: 90%; color: #222;"></textarea>

                    <div style="display: flex; justify-content: left; gap: 5px;">
                        <button style="background-color: #4CAF50;" onclick="resposta_desconto(this, '${id}', 'aprovado')">Autorizar</button>
                        <button style="background-color: #B12425;" onclick="resposta_desconto(this, '${id}', 'reprovado')">Reprovar</button>
                    </div>
                </div>
            </div>
        `
    }

    let painel = `
    <div id="painel_aprovacoes" style="z-index: 4444; position: fixed; bottom: 2vw; right: 2vw; display: flex; align-items: center; justify-content: start; flex-direction: column; gap: 5px; height: 70vh; overflow: auto;">
        ${acumulado}
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', painel)
}

function resposta_desconto(botao, id, status) {

    let justificativa = botao.parentElement.parentElement.querySelector('textarea').value

    let aprovacao = {
        usuario: acesso.usuario,
        status,
        justificativa
    }

    enviar(`aprovacoes/${id}/aprovacao`, aprovacao)

    botao.parentElement.parentElement.parentElement.remove()

}

async function verificar_chamado_existente(chamado, id_atual, sequencial, clone) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/chamado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chamado, id_atual, sequencial, clone })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}