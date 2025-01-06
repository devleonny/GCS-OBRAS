var acesso = JSON.parse(localStorage.getItem('acesso'))
var versao = 'v2.0.59'

document.addEventListener('keydown', function (event) {

    if (event.key === 'F5') {

        f5()

    }

});

function f5() {

    location.reload();

}

localStorage.removeItem('dados_cliente')
localStorage.removeItem('dados_composicoes')
localStorage.removeItem('lista_pagamentos')

function inserirDados(dados, nome_da_base) {
    // Primeiro, abra o banco para verificar a versão e stores existentes
    const request = indexedDB.open('Bases');
    let novaVersao;

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

    transaction.oncomplete = function () {

        console.log('Transação concluída com sucesso!');
        if(document.title == "PAGAMENTOS" && !(localStorage.getItem("first_acess"))){
            localStorage.setItem("first_acess","true")
            f5()
        }
    };

}


async function recuperarDados(nome_da_base) {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open('Bases');

        request.onsuccess = function (event) {

            const db = event.target.result;

            if (!db.objectStoreNames.contains(nome_da_base)) {

                console.warn(`Store "${nome_da_base}" não existe no banco.`);
                resolve(null);
                return;

            }

            const transaction = db.transaction([nome_da_base], 'readonly');
            const store = transaction.objectStore(nome_da_base);

            const getRequest = store.get(1);

            getRequest.onsuccess = function (event) {

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


if (acesso && document.title !== 'PDF') {

    let texto = `

    <div style="position: relative; display: fixed;">
        <label onclick="openPopup_v2('Deseja se desconectar?', true, 'sair()')"
        style="cursor: pointer; position: absolute; top: 10px; right: 10px; color: white; font-family: 'Poppins', sans-serif;">${acesso.usuario} • ${acesso.permissao} • Desconectar • ${versao}</label>
    </div>

    `
    document.body.insertAdjacentHTML('beforebegin', texto)

}

function openPopup_v2(mensagem, exibir_botoes, funcao_confirmar) {

    let botoes = ''

    if (exibir_botoes) {

        botoes += `

        <div style="display: flex; gap: 20px; align-items: center; justify-content: center;">
            <button style="background-color: green;" onclick="${funcao_confirmar}">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
        </div>

    `

}

    let popup_v2 = `

    <div id="temp_pop" class="popup" style="display: block;">
        <div class="popup-content">
            <span class="close" onclick="remover_popup()">&times;</span>
            <p>${mensagem}</p>
            ${botoes}
        </div>
    </div>

    `

    document.body.insertAdjacentHTML('beforeend', popup_v2)

}

if (document.title !== 'PDF') {

    alertas()

}

async function alertas() {

    let exibir = false

    let info = `

    <div id="alertas_div" class="flutuante">
        <span class="close" onclick="mostrar_ocultar_alertas()">&times;</span>
        <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
            <img src="/gifs/atencao.gif">
            <label style="font-size: 2.0em;">Notificações</label>
        </div>
        <div style="color: white; background-color: #222; border-radius: 3px;">
            ${consultar_pagamentos(true)}
            <button onclick="window.location.href = '/htmls/pagamentos.html'">Ir para pagamentos</button>
        </div>
    </div>
    
    <div id="icone_alerta" onclick="mostrar_ocultar_alertas()" style="box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); color: #222; display: flex; align-items: center; justify-content: center; cursor: pointer; position: fixed; bottom: 10px; left: 10px; border-radius: 3px; background-color: white; padding: 10px; gap: 10px;">
        <img src="/gifs/atencao.gif">
    </div>

    `

    if (exibir) {

        document.body.insertAdjacentHTML('beforeend', info)

    }

}

function dicionario(item) {

    return typeof item === "object" && item !== null && item.constructor === Object;

}

function mostrar_ocultar_alertas() {

    let alertas_div = document.getElementById('alertas_div')
    let icone_alerta = document.getElementById('icone_alerta')
    let overlay = document.getElementById('overlay')

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

function remover_popup() {

    let pop = document.getElementById('temp_pop')

    while (pop) {

        pop.remove()
        pop = document.getElementById('temp_pop')

    }

    let telas = ['status', 'espelho_ocorrencias', 'estrutura', 'detalhes', 'imagem_upload']
    let manter_overlay = false

    telas.forEach(tl => {

        let tela = document.getElementById(tl)
        if (tela) {

            manter_overlay = true

        }

    })

    let overlay = document.getElementById('overlay')

    if (overlay && !manter_overlay) {

        overlay.style.display = 'none'

    }

    try {

        encerrarIntervalos()

    } catch { }

}

function sair() {

    localStorage.removeItem('acesso')
    window.location.href = '/htmls/login.html'

}

function atraso(func, delay) {

    let timeout;

    return function (...args) {

        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);

    };

}

function unicoID() {

    let d = new Date().getTime();

    if (window.performance && typeof window.performance.now === "function") {

        d += performance.now();

    }

    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {

        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);

    });

    return uuid;

}

function carregar_orcamentos() {

    fetch('https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=orcamentos')

        .then(response => {

            if (!response.ok) {

                throw new Error('Erro ao carregar os dados');

            }

            return response.json();

        })

        .then(data => {

            let orcamentos = {}

            data.forEach(function (orcamento) {

                let orcamento_parse = JSON.parse(orcamento)

                let id_orcamento = orcamento_parse.id

                orcamentos[id_orcamento] = orcamento_parse

            })

            localStorage.setItem('dados_orcamentos', JSON.stringify(orcamentos))

        })

}

function maiorId(prefixo) {

    let ids = document.querySelectorAll('[id^="' + prefixo + '"]');
    let maiorValor = 0;

    ids.forEach(function (elemento) {

        let numeroId = parseInt(elemento.id.substring(prefixo.length));

        if (!isNaN(numeroId) && numeroId > maiorValor) {

            maiorValor = numeroId;

        }

    });

    return maiorValor + 1;

}

function ampliar(url) {

    let div = document.getElementById('imagem_upload');
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
        stringMonetario = stringMonetario.replace(/[^\d,]/g, '');
        stringMonetario = stringMonetario.replace(',', '.');
        let valorNumerico = parseFloat(stringMonetario);

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

    window.location.href = '/htmls/orcamentos.html'

}

function fecharPopup() {

    let popup = document.getElementById('popup');
    popup.classList.remove('aberto');

}

function ir_pdf(orcam_) {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

    localStorage.setItem('pdf', JSON.stringify(dados_orcamentos[orcam_]))

    try {

        const { ipcRenderer } = require('electron');
        ipcRenderer.invoke('open-new-window', 'pdf.html');
    } catch {
        window.location.href = ('pdf.html');
    }
}


function criar_orcamento_janela() {

    const { ipcRenderer } = require('electron');

    ipcRenderer.invoke('open-new-window', '/htmls/adicionar.html');
    //window.location.href = ('/htmls/pdf.html');

}

function removerLinha(select) {

    let linha = select.closest('tr');
    linha.parentNode.removeChild(linha);

}

function apagar(codigo_orcamento) {

    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'))

    let exclusao_orcamento = {

        'tabela': 'excluir',
        'id': codigo_orcamento

    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'

        },
        body: JSON.stringify(exclusao_orcamento)

    })

    remover_popup()
    fechar_espelho_ocorrencias()
    openPopup_v2('Orçamento Excluído');

    delete dados_orcamentos[codigo_orcamento]

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))
    preencher_dados_orcamentos()

}

function calcularProporcao(dataInicio, dataFim) {

    let hoje = new Date();

    let inicio = new Date(formatodata(dataInicio));
    let fim = new Date(formatodata(dataFim));

    if (inicio > hoje) {

        return '0%';

    }

    let diferenca = Math.abs(fim - inicio);
    let diasTotais = diferenca / (1000 * 3600 * 24);

    let diferencaHoje = Math.abs(hoje - inicio);
    let diasPassados = diferencaHoje / (1000 * 3600 * 24);

    let proporcao = (diasPassados / diasTotais) * 100;

    let resultado = Math.min(proporcao, 100).toFixed(2) + '%';

    return resultado;

}

function formatodata(data) {

    let partes = data.split('/');
    let dia = partes[0];
    let mes = partes[1];
    let ano = partes[2];
    return `${ano}-${mes}-${dia}`;

}

function sincronizar_orcamento(orcamento) {

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(orcamento)

    })

}

function pesquisar_itens() {

    let pesquisa = document.getElementById('campo-pesquisa-itens').value

    local_dados_itens(pesquisa)

}

function local_dados_itens(pesquisa) {

    let tabela = document.getElementById('tabela_itens')

    tabela.innerHTML = ''

    let dados_itens = JSON.parse(localStorage.getItem('dados_itens'))

    if (dados_itens) {

        dados_itens.forEach(function (linha) {

            let tr = document.createElement('tr');

            let textos = []

            for (let i = 0; i < 8; i++) {

                let td = document.createElement('td');

                if (i === 7) {

                    let img = document.createElement('img')
                    img.src = linha[i]
                    img.style = 'width: 30px;'
                    img.addEventListener('click', function () {

                        ampliar(linha[i])

                    })

                    td.style.width = '5vh'
                    td.appendChild(img)
                    tr.appendChild(td);

                } else if (i === 4 || i === 6) {

                    continue

                } else {

                    td.textContent = linha[i]
                    textos.push(linha[i])
                    tr.appendChild(td);

                }

            }

            if (!pesquisa || pesquisa.trim() === '') {

                tabela.appendChild(tr)

            } else {

                let adicionaLinha = false

                textos.forEach(function (texto) {

                    if (typeof texto === 'string' && texto.toLowerCase().includes(pesquisa.toLowerCase())) {

                        adicionaLinha = true

                    }

                })

                if (adicionaLinha) {

                    tabela.appendChild(tr)

                }

            }

        });

    }

}

function contagem_regressiva(elemento, limite) {

    let local_elemento = document.getElementById(elemento)

    if (local_elemento) {

        let acumulado = `
        <label id="cronometro"></label>
        `

        local_elemento.insertAdjacentHTML('beforeend', acumulado)

        let intervalo = setInterval(function () {

            let cronometro = document.getElementById('cronometro');

            if (cronometro && limite > 0) {

                limite -= 1;
                cronometro.textContent = `${limite}s`;

            } else {

                if (cronometro) {

                    cronometro.remove();

                }

                clearInterval(intervalo);

            }

        }, 1000);

    }

}

function fechar_popup_composicoes() {

    document.getElementById('retangulo_glass').style.display = 'none'
    document.getElementById('overlay').style.display = 'none'

}

function fechar_popup_logistica() {

    document.getElementById('retangulo_logistica').style.display = 'none'

}

async function recuperar_dados_clientes() {

    let acompanhamento_dados_clientes = document.getElementById('acompanhamento_dados_clientes')

    if (acompanhamento_dados_clientes) {

        acompanhamento_dados_clientes.innerHTML = 
        
        `

        <div style="display: flex; align-items: center; justify-content: left;">
        <img src="/gifs/loading.gif" style="width: 50px"> 
        <label>Aguarde alguns segundos... </label>
        </div>

        `

    }

    return new Promise((resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=clientes_v2'

        return fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                inserirDados(data, 'dados_clientes')

                if (acompanhamento_dados_clientes) {

                    dados_clientes_provisorios = data
                    carregar_datalist_clientes()
                    acompanhamento_dados_clientes.innerHTML = 
                    
                    `

                        <img src="/gifs/alerta.gif" style="width: 30px;">
                        <label style="text-decoration: underline; cursor: pointer;" onclick="recuperar_dados_clientes()">Clique aqui para sincronizar com o Omie os dados do Cliente...</label>

                    `

                }

                resolve();

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}

function obter_materiais() {

    return new Promise((resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbyw6ptagP-UT4IDjnhLHgpdD8wtFqUpgrczCEjVxW8u-fuD6y2QKqmTWlpYs8nM2rWW/exec?bloco=materiais'

        return fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                localStorage.setItem('dados_materiais', JSON.stringify(data));
                resolve();

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}

async function recuperar() {

    obter_materiais()
    await recuperar_dados_composicoes()

    return new Promise((resolve, reject) => {

        let requisicoes = {

            'dados_grupos': 'grupos',
            'dados_categorias': 'categorias',
            'dados_pagamentos': 'pagamentos',
            'vendedores': 'vendedores',
            'dados_etiquetas': 'etiquetas',
            'dados_comentarios': 'comentarios'

        };

        let alicia_keys = Object.keys(requisicoes);

        let promises = alicia_keys.map(function (api) {

            let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=' + requisicoes[api];

            return fetch(url)

                .then(response => {

                    if (!response.ok) {

                        throw new Error('Erro ao carregar os dados');

                    }

                    return response.json();

                })

                .then(data => {

                    localStorage.setItem(api, JSON.stringify(data));

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

function formato(texto) {

    switch (true) {

        case String(texto).includes('pdf'):
            return 'PDF'

        case String(texto).includes('image'):
            return 'IMAGEM'

        case String(texto).includes('text'):
            return 'TXT'

        case String(texto).includes('sheet'):
            return 'PLANILHA'

        default:
            return 'OUTROS'

    }

}

function baixar_em_excel(nome_tabela, filename) {

    let table = document.getElementById(nome_tabela)

    let wb = XLSX.utils.table_to_book(table, { sheet: "GCS" });

    filename = filename ? filename + '.xlsx' : 'excel_data.xlsx';

    XLSX.writeFile(wb, filename);

}

function enviar_lista_pagamentos(dados) {


    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(dados)

    })

}

function data_atual(estilo, parceiro) {

    let dataAtual = new Date();

    if (parceiro !== undefined) {

        // let dataAtual = new Date(2024, 10, 10, 10, 0, 0, 0);
        let diaDeHoje = dataAtual.getDate();
        let ano = dataAtual.getFullYear();
        let mes = dataAtual.getMonth();

        if (parceiro == 'Pagamento de Parceiros' && diaDeHoje > 5) {

            diaDeHoje = 10;
            mes += 1;

        } else if (parceiro == 'Pagamento de Parceiros') {

            diaDeHoje = 10;

        } else if (parceiro == 'Adiantamento de Parceiros') {

            diaDeHoje += 8;

            let diasNoMes = new Date(ano, mes + 1, 0).getDate();

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

        let dataFormatada = new Date().toLocaleString('pt-BR', {

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

async function obter_lista_pagamentos() {

    await carimbo_data_hora_pagamentos()

    return new Promise((resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=lista_pagamentos';

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {
                localStorage.setItem('lista_pagamentos', JSON.stringify(data));
                resolve();

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}

async function lista_setores() {

    return new Promise((resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=setores';

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                localStorage.setItem('dados_setores', JSON.stringify(data));
                resolve();

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}

async function obter_departamentos_fixos() {

    return new Promise((resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=departamentosFixos';

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                localStorage.setItem('departamentos_fixos', JSON.stringify(data));
                resolve();

            })
            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}

async function carimbo_data_hora_pagamentos() {

    return new Promise((resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=carimbo';

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                localStorage.setItem('carimbo_data_hora_pagamentos', JSON.stringify(data));
                resolve();

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);
                reject(error);

            });

    });

}


function fecharTabela(nome_tabela) {

    document.getElementById(nome_tabela).style.display = 'none'
    document.getElementById('overlay').style.display = 'none'

}

function gerarNumeroAleatorio() {

    let numeroAleatorio = Math.floor(10000 + Math.random() * 90000);

    let dataAtual = new Date();
    let hora = dataAtual.getHours();
    let minutos = dataAtual.getMinutes();
    let segundos = dataAtual.getSeconds();

    hora = hora < 10 ? '0' + hora : hora;
    minutos = minutos < 10 ? '0' + minutos : minutos;
    segundos = segundos < 10 ? '0' + segundos : segundos;

    let numeroComHora = numeroAleatorio.toString() + hora.toString() + minutos.toString() + segundos.toString();

    return numeroComHora;

}

function incluir_composicao_api(codigo) {

    let dados_composicoes = JSON.parse(localStorage.getItem('dados_composicoes'))

    let dados = {

        'tabela': 'composicoes',
        'codigo': codigo,
        'composicao': dados_composicoes[codigo]

    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(dados)

    });

}

if (document.title !== 'PDF') {

    calculadora_reversa()

    valor_liquido.addEventListener('input', function () {

        calcular()

    })

    icms_toggle.addEventListener('input', function () {

        calcular()

    })

}

function calcular() {

    let valor = Number(valor_liquido.value)

    let porcentagem = 0
    icms_toggle.checked == true ? porcentagem = 0.12 : porcentagem = 0.205

    let resultado = valor * 1 / (1 - porcentagem)

    valor_com_imposto.textContent = dinheiro(resultado)

}

function exibir_calculadora() {

    calculadora.classList.toggle('show');

}

function calculadora_reversa() {

    let calculadora = ''

    /* No momento irei desativar;
    if(document.title !== 'Criar Orçamento'){ 

        calculadora +=`
        <div id="mini_calculadora">
        <label>Calculadora ICMS</label>
        <img src="/imagens/calculadora.png" style="width: 50px; cursor: pointer;" onclick="exibir_calculadora()">
        </div>
    `

    }
    */

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

        <img src="/imagens/avanco.png">
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


function atualizar_etiqueta(id, id_etiqueta, data, operacao) {

    let dados = {

        'tabela': 'incluirEtiqueta',
        'data': data,
        'id_etiqueta': id_etiqueta,
        'id': id

    }

    if (operacao !== undefined) {

        dados.operacao = operacao

    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(dados)
        
    })

}

function pesquisar_em_pagamentos(coluna, texto) {

    filtrosAtivosPagamentos[coluna] = texto.toLowerCase();

    let tabela_itens = document.getElementById('body');
    let trs = tabela_itens.querySelectorAll('tr');

    let thead_pesquisa = document.getElementById('thead_pesquisa');
    let inputs = thead_pesquisa.querySelectorAll('input');
    inputs[coluna].value = texto

    trs.forEach(function (tr) {

        let tds = tr.querySelectorAll('td');
        let mostrarLinha = true;

        for (let col in filtrosAtivosPagamentos) {

            let filtroTexto = filtrosAtivosPagamentos[col];

            if (filtroTexto && col < tds.length) {

                let conteudoCelula = tds[col].textContent.toLowerCase();

                if (!conteudoCelula.includes(filtroTexto)) {

                    mostrarLinha = false;
                    break;

                }

            }

        }

        tr.style.display = mostrarLinha ? '' : 'none';

    });

}

function carregamento(local) {

    let local_elemento = document.getElementById(local)

    local_elemento.innerHTML = '';

    let elemento = `

    <div id="carregamento" style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 10px;">
        <img src="/gifs/loading.gif" style="width: 5vw">
        <label style="color: white; font-size: 1.5em;">Aguarde...</label>
    </div>

    `

    local_elemento.insertAdjacentHTML('beforeend', elemento)

}

function carregar_opcoes(items, id_input, id_div_sugestoes) {

    let input = document.getElementById(id_input);
    let sugestoes = document.getElementById(id_div_sugestoes);

    input.innerHTML = ''
    sugestoes.innerHTML = ''

    input.addEventListener('input', function () {

        let query = String(input.value).toUpperCase()
        sugestoes.innerHTML = '';

        if (query === '') return;

        let filtrados = []

        items.forEach(it => {

            if (String(it).includes(query)) {

                filtrados.push(it)

            }

        })

        filtrados.forEach(item => {

            let div = document.createElement('div');
            div.textContent = item;
            div.classList.add('autocomplete-item');

            div.addEventListener('click', function () {

                input.value = item;
                sugestoes.innerHTML = '';

            });

            sugestoes.appendChild(div);

        });

    });

    document.addEventListener('click', function (event) {

        if (document.querySelector('.autocomplete-container') && !document.querySelector('.autocomplete-container').contains(event.target)) {

            sugestoes.innerHTML = '';
            calculadora_pagamento()

        }

    });

}

function opcoes_centro_de_custo() {

    let centros_de_custo = {};
    let options = [];

    let departamentos_fixos = JSON.parse(localStorage.getItem('departamentos_fixos')) || [];
    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};

    let contador = 1;

    Object.keys(dados_orcamentos).forEach(chave_orc => {

        let orc = dados_orcamentos[chave_orc];

        if (orc.status) {

            for (let chave1 in orc.status) {

                let elemento = `${orc.status[chave1].pedido} - ${orc.dados_orcam.contrato} - ${orc.dados_orcam.cliente_selecionado} - [${contador}]`;
                options.push(elemento)

                let cod = elemento.match(/\[(\d+)\]$/)[1];

                if (!centros_de_custo[cod]) {

                    centros_de_custo[cod] = {};

                }

                centros_de_custo[cod] = {

                    key_orc: chave_orc,
                    key_pedido: chave1

                };

                contador++;

            }

        }

    });

    departamentos_fixos.forEach(dep => {

        let elemento = `${dep} - [${contador}]`;

        options.push(elemento)

        centros_de_custo[contador] = {

            key_orc: dep,
            key_pedido: ''

        };

        contador++;

    });

    return options;

}

async function conversor_composicoes_orcamento(orcamento) {

    if ("dados_composicoes_orcamento" in orcamento) {

        let composicoes = await recuperarDados('dados_composicoes') || {};

        let dados_composicoes = orcamento.dados_composicoes
        let dados_composicoes_orcamento = orcamento.dados_composicoes_orcamento

        let new_dados_composicoes = {}

        dados_composicoes.forEach(item => {

            new_dados_composicoes[item.codigo] = {

                codigo: item.codigo,
                custo: conversor(item.custo),
                qtde: item.qtde,
                total: conversor(item.total),
                tipo: item.tipo

            }

        })

        for (codigo_subs in dados_composicoes_orcamento) {

            let itens = dados_composicoes_orcamento[codigo_subs]

            for (codigo_certo in itens) {

                let subs = composicoes[codigo_certo].substituto

                if (subs == '') {

                    subs = codigo_certo

                }

                if (new_dados_composicoes[subs]) {

                    delete new_dados_composicoes[subs]

                }

                let quantidade = conversor(itens[codigo_certo].qtde)
                let ativo = composicoes[subs]['lpu carrefour'].ativo
                let historico = composicoes[subs]['lpu carrefour'].historico
                let unitario = historico[ativo].valor

                let ativo_certo = composicoes[codigo_certo]['lpu carrefour'].ativo
                let historico_certo = composicoes[codigo_certo]['lpu carrefour'].historico
                let unitario_certo = historico_certo[ativo_certo].valor

                quantidade = Math.ceil((unitario_certo / unitario)) * quantidade

                new_dados_composicoes[codigo_certo] = {

                    codigo: codigo_certo,
                    custo: unitario,
                    qtde: quantidade,
                    total: quantidade * unitario,
                    tipo: composicoes[codigo_certo].tipo

                }

            }

        }

        delete orcamento.dados_composicoes_orcamento
        orcamento.dados_composicoes = new_dados_composicoes

        fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

            method: 'POST',
            mode: 'no-cors',
            headers: {

                'Content-Type': 'application/json'

            },

            body: JSON.stringify(orcamento)

        })

    }

    return orcamento

}

function encurtar_texto(texto, limite) {

    if (texto.length > limite) {

        return texto.slice(0, limite) + "...";

    }

    return texto;

}

function enviar_dados_generico(dados) {

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'
            
        },
        body: JSON.stringify(dados)

    })

}

async function consultar_pagamentos(especial) { //True aqui vai retornar o painel de títulos com as contagens;
    var acumulado = ''
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
    var orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}
    var dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var clientes = {}
    var linhas = ''
    dados_categorias = Object.fromEntries(

        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])

    );

    Object.keys(dados_clientes).forEach(item => {

        let cliente = dados_clientes[item]
        clientes[cliente.omie] = cliente

    })

    let pagamentosFiltrados = Object.keys(lista_pagamentos)

        .map(pagamento => {
            var pg = lista_pagamentos[pagamento];
            if (pg.criado !== 'Omie') {

                let continuar = false

                if (acesso.permissao == 'gerente' && dados_setores[acesso.usuario].setor == dados_setores[pg.criado].setor) {

                    continuar = true

                } else if (pg.criado === acesso.usuario) {

                    continuar = true

                } else if (acesso.permissao == 'diretoria' || acesso.permissao == 'adm' || acesso.permissao == 'fin') {

                    continuar = true

                }

                if (continuar) {

                    let valor_categorias = pg.param[0].categorias.map(cat =>

                        `<p>${dinheiro(cat.valor)} - ${dados_categorias[cat.codigo_categoria]}</p>`

                    ).join('');

                    let nome_orcamento = orcamentos[pg.id_orcamento]
                        ? orcamentos[pg.id_orcamento].dados_orcam.cliente_selecionado
                        : pg.departamento;

                    let data_registro = pg.data_registro || pg.param[0].data_previsao;

                    return {

                        id: pagamento,
                        param: pg.param,
                        data_registro,
                        data_previsao: pg.param[0].data_previsao,
                        nome_orcamento,
                        valor_categorias,
                        status: pg.status,
                        observacao: pg.param[0].observacao,
                        criado: pg.criado,
                        anexos: pg.anexos

                    };

                }

            }

            return null;

        })

        .filter(Boolean);

    const parseDate = (data) => {

        const [dia, mes, ano] = data.split('/').map(Number);
        return new Date(ano, mes - 1, dia);

    };

    pagamentosFiltrados.sort((a, b) => parseDate(b.data_previsao) - parseDate(a.data_previsao));

    let contadores = {

        gerente: { qtde: 0, valor: 0, termo: 'gerência', label: 'Aguardando aprovação da Gerência', icone: "/imagens/gerente.png" },
        diretoria: { qtde: 0, valor: 0, termo: 'da diretoria', label: 'Aguardando aprovação da Diretoria', icone: "/imagens/diretoria.png" },
        reprovados: { qtde: 0, valor: 0, termo: 'reprovado', label: 'Reprovados', icone: "/imagens/remover.png" },
        excluidos: { qtde: 0, valor: 0, termo: 'excluído', label: 'Pagamentos Excluídos', icone: "/gifs/alerta.gif" },
        salvos: { qtde: 0, valor: 0, termo: 'localmente', label: 'Salvo localmente', icone: "/imagens/salvo.png" },
        pago: { qtde: 0, valor: 0, termo: 'pago', label: 'Pagamento realizado', icone: "/imagens/concluido.png" },
        avencer: { qtde: 0, valor: 0, termo: 'a vencer', label: 'Pagamento será feito outro dia', icone: "/imagens/avencer.png" },
        hoje: { qtde: 0, valor: 0, termo: 'hoje', label: 'Pagamento será feito hoje', icone: "/imagens/vencehoje.png" },
        todos: { qtde: 0, valor: 0, termo: '', label: 'Todos os pagamentos', icone: "/imagens/voltar.png" }

    }

    for (pagamento in pagamentosFiltrados) {

        let pg = pagamentosFiltrados[pagamento]

        let icone = ''

        if (pg.status == 'PAGO') {

            icone = contadores.pago.icone
            contadores.pago.qtde += 1
            contadores.pago.valor += pg.param[0].valor_documento

        } else if (pg.status == 'Aguardando aprovação da Diretoria') {

            icone = contadores.diretoria.icone
            contadores.diretoria.qtde += 1
            contadores.diretoria.valor += pg.param[0].valor_documento

        } else if (pg.status == 'A VENCER') {

            icone = contadores.avencer.icone
            contadores.avencer.qtde += 1
            contadores.avencer.valor += pg.param[0].valor_documento

        } else if (pg.status == 'Aguardando aprovação da Gerência') {

            icone = contadores.gerente.icone
            contadores.gerente.qtde += 1
            contadores.gerente.valor += pg.param[0].valor_documento

        } else if (pg.status == 'VENCE HOJE') {

            icone = contadores.hoje.icone
            contadores.hoje.qtde += 1
            contadores.hoje.valor += pg.param[0].valor_documento

        } else if (pg.status.includes('Reprovado')) {

            icone = contadores.reprovados.icone
            contadores.reprovados.qtde += 1
            contadores.reprovados.valor += pg.param[0].valor_documento

        } else if (pg.status.includes('Pagamento salvo localmente')) {

            icone = contadores.salvos.icone
            contadores.salvos.valor += pg.param[0].valor_documento
            contadores.salvos.qtde += 1

        } else if (pg.status.includes('Excluído')) {

            icone = contadores.excluidos.icone
            contadores.excluidos.valor += pg.param[0].valor_documento
            contadores.excluidos.qtde += 1

        } else {

            icone = "/gifs/alerta.gif"

        }
        contadores.todos.qtde += 1
        contadores.todos.valor += pg.param[0].valor_documento

        let div = 
        
        `

        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
            <img src="${icone}" style="width: 30px;">
            <label>${pg.status}</label>
        </div>

        `

        let setor_criador = ''

        if (dados_setores[pg.criado]) {

            setor_criador = dados_setores[pg.criado].setor

        }

        let recebedor = pg.param[0].codigo_cliente_fornecedor

        if (clientes[recebedor]) {

            recebedor = clientes[recebedor].nome

        }

        linhas += 
        
        `

            <tr>
                <td>${pg.data_previsao}</td>
                <td>${pg.nome_orcamento}</td>
                <td style="text-align: left;">${pg.valor_categorias}</td>
                <td>${div}</td>
                <td>${pg.criado}</td>
                <td>${setor_criador}</td>
                <td>${recebedor}</td>
                <td style="text-align: center;"><img src="/imagens/pesquisar2.png" style="width: 30px; cursor: pointer;" onclick="abrir_detalhes('${pg.id}')"></td>
            </tr>

        `
    };

    var carimbo_data_hora_pagamentos = JSON.parse(localStorage.getItem('carimbo_data_hora_pagamentos'))[0] || ''

    let colunas = ['Data de Previsão', 'Centro de Custo', 'Valor e Categoria', 'Status Pagamento', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']

    let cabecalho1 = ''
    let cabecalho2 = ''

    colunas.forEach((coluna, i) => {

        cabecalho1 += 
        
        `

            <th style="background-color: #B12425;">${coluna}</th>

            `
        cabecalho2 += 
        
        `

            <th style="background-color: white; position: relative; border-radius: 0px;">
            <img src="/imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
            <input style="width: 100%;" style="text-align: center;" placeholder="${coluna}" oninput="pesquisar_em_pagamentos(${i}, this.value)">
            </th>

            `

    })

    let titulos = ''

    for (item in contadores) {

        if (contadores[item].valor !== 0) {
            titulos += `
            <Label style="display: flex; gap: 10px"><label class="contagem" onclick="pesquisar_em_pagamentos(3, '${contadores[item].termo}')">${contadores[item].qtde}</label> <img src="${contadores[item].icone}" style="width: 25px; height: 25px;"><strong> ${dinheiro(contadores[item].valor)}</strong> • ${contadores[item].label}</label>
            `

        }

    }

    var div_titulos = `
        <div style="display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: left; margin: 3vw; font-size: 1.2em;">
        ${titulos}
        </div>

    `
    if (especial) {

        return div_titulos

    }

    acumulado += `
    <div>
        <div style="display: flex; gap: 10px; justify-content: space-evenly; align-items: center; width: 100%; color: white;">
            

            <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento()">
                <label>Novo <strong>Pagamento</strong></label>
            </div>

            ${div_titulos}

            <div style="display: flex; flex-direction: column; gap: 10px; justify-content: space-evenly; align-items: start; background-color: #22222287; border-radius: 5px; padding: 10px; margin: 30px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);">

                <div style="display: flex; justify-content: space-evenly; width: 100%; gap:">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;"
                        onclick="window.location.href='inicial.html'">
                        <img src="/imagens/voltar.png" style=" cursor: pointer;" onclick="window.location.href='inicial.html'">
                        <label style="color: white;">Voltar</label>
                    </div>
                    

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <img src="/imagens/atualizar_2.png" style="width: max-content; cursor: pointer;" onclick="atualizar_pagamentos_menu()">
                        <label style="color: white;">Atualizar</label>
                    </div>
                </div>

                <label>Sincronizado: ${carimbo_data_hora_pagamentos}</label>

                <label id="andamento">...</label>
            </div>


        </div>
        <div style="border-radius: 5px; height: 800px; overflow-y: auto;">
            <table id="pagamentos" style="width: 100%; color: #222; font-size: 0.8em; border-collapse: collapse; table-layout: fixed;">
                <thead>
                    ${cabecalho1}
                </thead>
                <thead id="thead_pesquisa">
                    ${cabecalho2}
                </thead>
                <tbody id="body">
                    ${linhas}
                </tbody>
            </table>
        </div>
    </div>

    `
    var div_status = document.getElementById('status')

    div_status.innerHTML = ''

    div_status.innerHTML = acumulado

}

function salvar_levantamento(id_orcamento) {

    let elemento = document.getElementById('adicionar_levantamento')
    let file = elemento.files[0];

    if (file) {

        let fileInput = elemento
        let file = fileInput.files[0];
        let fileName = file.name

        if (!file) {

            openPopup_v2('Nenhum arquivo selecionado...');
            return;

        }

        let reader = new FileReader();

        reader.onload = async (e) => {

            let base64 = e.target.result.split(',')[1];
            let mimeType = file.type;

            let response = await fetch('http://localhost:3000/upload', {

                method: 'POST',
                headers: {

                    'Content-Type': 'application/json'

                },
                body: JSON.stringify({

                    name: fileName,
                    mimeType: mimeType,
                    base64: base64

                })

            });

            let result = await response.json();

            if (response.ok) {

                let anexo = {}

                anexo[gerar_id_5_digitos()] = {

                    nome: fileName,
                    formato: mimeType,
                    link: result.fileId

                }

                let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

                if (id_orcamento) {

                    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
                    let orcamento_v2 = dados_orcamentos[id_orcamento]

                }

                if (!orcamento_v2.levantamentos) {

                    orcamento_v2.levantamentos = {}

                }

                orcamento_v2.levantamentos = {

                    ...orcamento_v2.levantamentos,
                    ...anexo

                }

                if (id_orcamento) {

                    let dados = {

                        tabela: 'levantamento',
                        operacao: 'incluir',
                        id: id_orcamento,
                        anexo

                    }

                    enviar_dados_generico(dados)
                    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos));
                    abrir_esquema(id_orcamento)

                } else {

                    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));
                    recuperar_preenchido()

                }

            }

        };

        reader.readAsDataURL(file);

    }

}

function excluir_levantamento(id_orcamento, id_anexo) {

    let dados = {

        tabela: 'levantamento',
        operacao: 'excluir',
        anexo_id: id_anexo,
        id: id_orcamento

    }

    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

    let orcamento = dados_orcamentos[id_orcamento]

    delete orcamento.levantamentos[id_anexo]

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos));

    abrir_esquema(id_orcamento)

    enviar_dados_generico(dados)

}

function recuperar_dados_composicoes() {

    return new Promise(async (resolve, reject) => {

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=compos_v3';

        try {

            const response = await fetch(url);
            if (!response.ok) {

                throw new Error('Erro ao carregar os dados');

            }

            const data = await response.json();
            inserirDados(data, 'dados_composicoes');
            resolve();

        } catch (error) {

            console.error('Ocorreu um erro:', error);
            reject(error);

        }
        
    });

}
