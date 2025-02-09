var acesso = JSON.parse(localStorage.getItem('acesso'))
var versao = 'v3.0.4'

document.addEventListener('keydown', function (event) {
    if (event.key === 'F5') {
        f5()
    }
});

function f5() {
    location.reload();
}

//Provisoriamente;
localStorage.removeItem('dados_cliente')
localStorage.removeItem('dados_composicoes')
localStorage.removeItem('lista_pagamentos')
localStorage.removeItem('dados_pagamentos')
localStorage.removeItem('timestamps')

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

}

async function recuperarDados(nome_da_base) {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open('Bases');

        request.onsuccess = function (event) {
            const db = event.target.result;

            // Verificar se a store existe;
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
    var texto = `
    <div style="position: relative; display: fixed;">
        <label onclick="openPopup_v2('Deseja se desconectar?', true, 'sair()')"
        style="cursor: pointer; position: absolute; top: 10px; right: 10px; color: white; font-family: 'Poppins', sans-serif;">${acesso.usuario} • ${acesso.permissao} • Desconectar • ${versao}</label>
    </div>
    `
    document.body.insertAdjacentHTML('beforebegin', texto)
}

function openPopup_v2(mensagem, exibir_botoes, funcao_confirmar) {

    var botoes = ''
    if (exibir_botoes) {
        botoes += `
        <div style="display: flex; gap: 20px; align-items: center; justify-content: center;">
            <button style="background-color: green;" onclick="${funcao_confirmar}">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
        </div>
    `}

    var popup_v2 = `
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

    var exibir = false

    var info = `
    <div id="alertas_div" class="flutuante">
        <span class="close" onclick="mostrar_ocultar_alertas()">&times;</span>
        <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
            <img src="gifs/atencao.gif">
            <label style="font-size: 2.0em;">Notificações</label>
        </div>
        <div style="color: white; background-color: #222; border-radius: 3px;">
            ${consultar_pagamentos(true)}
            <button onclick="window.location.href = 'pagamentos.html'">Ir para pagamentos</button>
        </div>
    </div>
    
    <div id="icone_alerta" onclick="mostrar_ocultar_alertas()" style="box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); color: #222; display: flex; align-items: center; justify-content: center; cursor: pointer; position: fixed; bottom: 10px; left: 10px; border-radius: 3px; background-color: white; padding: 10px; gap: 10px;">
        <img src="gifs/atencao.gif">
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
    var alertas_div = document.getElementById('alertas_div')
    var icone_alerta = document.getElementById('icone_alerta')
    var overlay = document.getElementById('overlay')
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

    var pop = document.getElementById('temp_pop')

    while (pop) {
        pop.remove()
        pop = document.getElementById('temp_pop')
    }

    var telas = ['status', 'espelho_ocorrencias', 'estrutura', 'detalhes', 'imagem_upload']
    var manter_overlay = false
    telas.forEach(tl => {
        var tela = document.getElementById(tl)
        if (tela) {
            manter_overlay = true
        }
    })

    var overlay = document.getElementById('overlay')
    if (overlay && !manter_overlay) {
        overlay.style.display = 'none'
    }

    try {
        encerrarIntervalos()
    } catch { }

}

function sair() {
    localStorage.removeItem('acesso')
    window.location.href = 'login.html'
}

function atraso(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
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

function maiorId(prefixo) {
    var ids = document.querySelectorAll('[id^="' + prefixo + '"]');
    var maiorValor = 0;

    ids.forEach(function (elemento) {
        var numeroId = parseInt(elemento.id.substring(prefixo.length));

        if (!isNaN(numeroId) && numeroId > maiorValor) {
            maiorValor = numeroId;
        }
    });

    return maiorValor + 1;
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
        stringMonetario = stringMonetario.replace(/[^\d,]/g, '');
        stringMonetario = stringMonetario.replace(',', '.');
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
        const pdfUrl = `pdf.html`;
        ipcRenderer.invoke('open-new-window', pdfUrl);

    } catch {
        window.location.href = `https://devleonny.github.io/GCS-OBRAS/pdf.html`;
    }
}


function criar_orcamento_janela() {

    const { ipcRenderer } = require('electron');

    //novo 28/08/2024;
    ipcRenderer.invoke('open-new-window', 'adicionar.html');
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
        await deletar(`dados_orcamentos/${codigo_orcamento}`)
    }
    preencher_orcamentos_v2()
    fechar_espelho_ocorrencias()
    remover_popup()
}

function calcularProporcao(dataInicio, dataFim) {
    var hoje = new Date();

    var inicio = new Date(formatodata(dataInicio));
    var fim = new Date(formatodata(dataFim));

    if (inicio > hoje) {
        return '0%';
    }

    var diferenca = Math.abs(fim - inicio);
    var diasTotais = diferenca / (1000 * 3600 * 24);

    var diferencaHoje = Math.abs(hoje - inicio);
    var diasPassados = diferencaHoje / (1000 * 3600 * 24);

    var proporcao = (diasPassados / diasTotais) * 100;

    var resultado = Math.min(proporcao, 100).toFixed(2) + '%';

    return resultado;
}

function formatodata(data) {

    var partes = data.split('/');
    var dia = partes[0];
    var mes = partes[1];
    var ano = partes[2];
    return `${ano}-${mes}-${dia}`;
}

function sincronizar_orcamento(orcamento) {

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orcamento)
    })

}

function pesquisar_itens() {
    var pesquisa = document.getElementById('campo-pesquisa-itens').value

    local_dados_itens(pesquisa)
}

function local_dados_itens(pesquisa) {

    var tabela = document.getElementById('tabela_itens')

    tabela.innerHTML = ''

    let dados_itens = JSON.parse(localStorage.getItem('dados_itens'))

    if (dados_itens) {

        dados_itens.forEach(function (linha) {

            let tr = document.createElement('tr');

            var textos = []

            for (let i = 0; i < 8; i++) {

                var td = document.createElement('td');

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

    var local_elemento = document.getElementById(elemento)

    if (local_elemento) {

        var acumulado = `
        <label id="cronometro"></label>
        `
        local_elemento.insertAdjacentHTML('beforeend', acumulado)

        var intervalo = setInterval(function () {
            var cronometro = document.getElementById('cronometro');
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

    var acompanhamento_dados_clientes = document.getElementById('acompanhamento_dados_clientes')

    if (acompanhamento_dados_clientes) {
        acompanhamento_dados_clientes.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: left;">
        <img src="gifs/loading.gif" style="width: 50px">
        <label>Aguarde alguns segundos... </label>
        </div>
        `
    }

    return new Promise((resolve, reject) => {
        let url = 'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=clientes_v2'

        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    acompanhamento_dados_clientes.innerHTML = `
                    <img src="gifs/atencao.gif" style="width: 30px;">
                    <label style="text-decoration: underline; cursor: pointer;" onclick="recuperar_dados_clientes()">Erro ao sincronizar, tente novamente...</label>
                    `
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {

                inserirDados(data, 'dados_clientes')

                if (acompanhamento_dados_clientes) {
                    dados_clientes_provisorios = data
                    carregar_datalist_clientes()
                    acompanhamento_dados_clientes.innerHTML = `
                        <img src="gifs/alerta.gif" style="width: 30px;">
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

    return new Promise((resolve, reject) => {
        var requisicoes = {
            'categorias': 'dados_categorias',
            'vendedores': 'vendedores',
            'etiquetas': 'dados_etiquetas',
            'comentarios': 'dados_comentarios'
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

    var table = document.getElementById(nome_tabela)

    var wb = XLSX.utils.table_to_book(table, { sheet: "GCS" });

    filename = filename ? filename + '.xlsx' : 'excel_data.xlsx';

    XLSX.writeFile(wb, filename);
}

function enviar_lista_pagamentos(dados) {


    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}

function data_atual(estilo, parceiro) {
    var dataAtual = new Date();

    if (parceiro !== undefined) {

        // var dataAtual = new Date(2024, 10, 10, 10, 0, 0, 0);
        var diaDeHoje = dataAtual.getDate();
        var ano = dataAtual.getFullYear();
        var mes = dataAtual.getMonth();

        if (parceiro == 'Pagamento de Parceiros' && diaDeHoje > 5) {
            diaDeHoje = 10;
            mes += 1;
        } else if (parceiro == 'Pagamento de Parceiros') {
            diaDeHoje = 10;
        } else if (parceiro == 'Adiantamento de Parceiros') {
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

async function obter_lista_pagamentos() {

    await carimbo_data_hora_pagamentos()

    return new Promise((resolve, reject) => {
        var url = 'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=lista_pagamentos';

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {
                inserirDados(data, 'lista_pagamentos')
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
        var url = 'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=setores';

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
        var url = 'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=departamentosFixos';

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

async function carimbo_data_hora_pagamentos(retornar) {
    return new Promise((resolve, reject) => {
        var url = 'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=carimbo';

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {
                if (retornar) {
                    resolve(data);
                    return
                }
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

    var numeroAleatorio = Math.floor(10000 + Math.random() * 90000);

    var dataAtual = new Date();
    var hora = dataAtual.getHours();
    var minutos = dataAtual.getMinutes();
    var segundos = dataAtual.getSeconds();

    hora = hora < 10 ? '0' + hora : hora;
    minutos = minutos < 10 ? '0' + minutos : minutos;
    segundos = segundos < 10 ? '0' + segundos : segundos;

    var numeroComHora = numeroAleatorio.toString() + hora.toString() + minutos.toString() + segundos.toString();

    return numeroComHora;
}

function incluir_composicao_api(codigo) {

    var dados_composicoes = JSON.parse(localStorage.getItem('dados_composicoes'))

    var dados = {
        'tabela': 'composicoes',
        'codigo': codigo,
        'composicao': dados_composicoes[codigo]
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
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

    /* No momento irei desativar;
    if(document.title !== 'Criar Orçamento'){ 
        calculadora +=`
        <div id="mini_calculadora">
        <label>Calculadora ICMS</label>
        <img src="imagens/calculadora.png" style="width: 50px; cursor: pointer;" onclick="exibir_calculadora()">
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


function atualizar_etiqueta(id, id_etiqueta, data, operacao) {

    var dados = {
        'tabela': 'incluirEtiqueta',
        'data': data,
        'id_etiqueta': id_etiqueta,
        'id': id
    }

    if (operacao !== undefined) {
        dados.operacao = operacao
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
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

    var tabela_itens = document.getElementById('body');
    var trs = tabela_itens.querySelectorAll('tr');

    var thead_pesquisa = document.getElementById('thead_pesquisa');
    var inputs = thead_pesquisa.querySelectorAll('input');
    inputs[coluna].value = texto

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var mostrarLinha = true;

        for (var col in filtrosAtivosPagamentos) {
            var filtroTexto = filtrosAtivosPagamentos[col];

            if (filtroTexto && col < tds.length) {
                var conteudoCelula = tds[col].textContent.toLowerCase();

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

function carregar_opcoes(items, id_input, id_div_sugestoes) {

    var input = document.getElementById(id_input);
    var sugestoes = document.getElementById(id_div_sugestoes);

    input.innerHTML = ''
    sugestoes.innerHTML = ''

    input.addEventListener('input', function () {
        var query = String(input.value).toUpperCase()
        sugestoes.innerHTML = '';

        if (query === '') return;

        var filtrados = []

        items.forEach(it => {
            if (String(it).includes(query)) {
                filtrados.push(it)
            }
        })

        filtrados.forEach(item => {
            var div = document.createElement('div');
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

async function opcoes_centro_de_custo() {

    centros_de_custo = {};
    var options = [];

    var departamentos_fixos = JSON.parse(localStorage.getItem('departamentos_fixos')) || [];
    var dados_orcamentos = await recuperarDados('dados_orcamentos') || {};

    let contador = 1;

    Object.keys(dados_orcamentos).forEach(chave_orc => {
        var orc = dados_orcamentos[chave_orc];
        if (orc.status) {
            for (let chave1 in orc.status) {

                var elemento = `${orc.status[chave1].pedido} - ${orc.dados_orcam.contrato} - ${orc.dados_orcam.cliente_selecionado} - [${contador}]`;
                options.push(elemento)

                var cod = elemento.match(/\[(\d+)\]$/)[1];

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
        var elemento = `${dep} - [${contador}]`;

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

        var composicoes = await recuperarDados('dados_composicoes') || {};

        var dados_composicoes = orcamento.dados_composicoes
        var dados_composicoes_orcamento = orcamento.dados_composicoes_orcamento

        var new_dados_composicoes = {}
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

            var itens = dados_composicoes_orcamento[codigo_subs]

            for (codigo_certo in itens) {

                var subs = composicoes[codigo_certo].substituto

                if (subs == '') {
                    subs = codigo_certo
                }

                if (new_dados_composicoes[subs]) {
                    delete new_dados_composicoes[subs]
                }

                var quantidade = conversor(itens[codigo_certo].qtde)
                var ativo = composicoes[subs]['lpu carrefour'].ativo
                var historico = composicoes[subs]['lpu carrefour'].historico
                var unitario = historico[ativo].valor

                var ativo_certo = composicoes[codigo_certo]['lpu carrefour'].ativo
                var historico_certo = composicoes[codigo_certo]['lpu carrefour'].historico
                var unitario_certo = historico_certo[ativo_certo].valor

                quantidade = Math.ceil((unitario_certo / unitario)) * quantidade

                new_dados_composicoes[codigo_certo] = { // Cria o item nosso no dicionário dados_composicoes
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

        fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
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

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}

async function consultar_pagamentos(especial) { //True aqui vai retornar o painel de títulos com as contagens;

    var div_pagamentos = document.getElementById('div_pagamentos')
    if (!div_pagamentos) {
        return
    }
    div_pagamentos.innerHTML = ''

    var acumulado = ''
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    var orcamentos = await recuperarDados('dados_orcamentos') || {};
    var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}
    var dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var clientes = {}
    var linhas = ''
    dados_categorias = Object.fromEntries(
        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])
    );

    Object.keys(dados_clientes).forEach(item => {
        var cliente = dados_clientes[item]
        clientes[cliente.omie] = cliente
    })

    var pagamentosFiltrados = Object.keys(lista_pagamentos)
        .map(pagamento => {
            var pg = lista_pagamentos[pagamento];
            if (pg == 1) { // O indexedDB inclui um item com chave 1 no objeto... 
                return
            }
            if (pg.criado !== 'Omie') {

                var valor_categorias = pg.param[0].categorias.map(cat =>
                    `<p>${dinheiro(cat.valor)} - ${dados_categorias[cat.codigo_categoria]}</p>`
                ).join('');
                var nome_orcamento = orcamentos[pg.id_orcamento]
                    ? orcamentos[pg.id_orcamento].dados_orcam.cliente_selecionado
                    : pg.departamento;
                var data_registro = pg.data_registro || pg.param[0].data_previsao;

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
            return null;
        })
        .filter(Boolean);

    const parseDate = (data) => {
        const [dia, mes, ano] = data.split('/').map(Number);
        return new Date(ano, mes - 1, dia);
    };

    pagamentosFiltrados.sort((a, b) => parseDate(b.data_previsao) - parseDate(a.data_previsao));

    var contadores = {
        gerente: { qtde: 0, valor: 0, termo: 'gerência', label: 'Aguardando aprovação da Gerência', icone: "imagens/gerente.png" },
        qualidade: { qtde: 0, valor: 0, termo: 'qualidade', label: 'Aguardando aprovação da Qualidade', icone: "imagens/qualidade2.png" },
        diretoria: { qtde: 0, valor: 0, termo: 'da diretoria', label: 'Aguardando aprovação da Diretoria', icone: "imagens/diretoria.png" },
        reprovados: { qtde: 0, valor: 0, termo: 'reprovado', label: 'Reprovados', icone: "imagens/remover.png" },
        excluidos: { qtde: 0, valor: 0, termo: 'excluído', label: 'Pagamentos Excluídos', icone: "gifs/alerta.gif" },
        salvos: { qtde: 0, valor: 0, termo: 'localmente', label: 'Salvo localmente', icone: "imagens/salvo.png" },
        pago: { qtde: 0, valor: 0, termo: 'pago', label: 'Pagamento realizado', icone: "imagens/concluido.png" },
        avencer: { qtde: 0, valor: 0, termo: 'a vencer', label: 'Pagamento será feito outro dia', icone: "imagens/avencer.png" },
        hoje: { qtde: 0, valor: 0, termo: 'hoje', label: 'Pagamento será feito hoje', icone: "imagens/vencehoje.png" },
        todos: { qtde: 0, valor: 0, termo: '', label: 'Todos os pagamentos', icone: "imagens/voltar_2.png" }
    }

    for (pagamento in pagamentosFiltrados) {

        var pg = pagamentosFiltrados[pagamento]

        var icone = ''

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
        } else if (pg.status == 'Aguardando aprovação da Qualidade') {
            icone = contadores.qualidade.icone
            contadores.qualidade.qtde += 1
            contadores.qualidade.valor += pg.param[0].valor_documento
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
            icone = "gifs/alerta.gif"
        }
        contadores.todos.qtde += 1
        contadores.todos.valor += pg.param[0].valor_documento

        var div = `
        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
            <img src="${icone}" style="width: 30px;">
            <label>${pg.status}</label>
        </div>
        `
        var setor_criador = ''
        if (dados_setores[pg.criado]) {
            setor_criador = dados_setores[pg.criado].setor
        }

        var recebedor = pg.param[0].codigo_cliente_fornecedor

        if (clientes[recebedor]) {
            recebedor = clientes[recebedor].nome
        }

        linhas += `
            <tr>
                <td>${pg.data_previsao}</td>
                <td>${pg.nome_orcamento}</td>
                <td style="text-align: left;">${pg.valor_categorias}</td>
                <td>${div}</td>
                <td>${pg.criado}</td>
                <td>${setor_criador}</td>
                <td>${recebedor}</td>
                <td style="text-align: center;"><img src="imagens/pesquisar2.png" style="width: 30px; cursor: pointer;" onclick="abrir_detalhes('${pg.id}')"></td>
            </tr>
        `
    };

    var colunas = ['Data de Previsão', 'Centro de Custo', 'Valor e Categoria', 'Status Pagamento', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']

    var cabecalho1 = ''
    var cabecalho2 = ''
    colunas.forEach((coluna, i) => {

        cabecalho1 += `
            <th style="background-color: #B12425;">${coluna}</th>
            `
        cabecalho2 += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
            <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
            <input style="width: 100%;" style="text-align: center;" placeholder="..." oninput="pesquisar_em_pagamentos(${i}, this.value)">
            </th>
            `
    })

    var titulos = ''

    for (item in contadores) {
        if (contadores[item].valor !== 0) {
            titulos += `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.0vw;" onclick="pesquisar_em_pagamentos(3, '${contadores[item].termo}')">
                <label class="contagem" style="background-color: #B12425; color: white;">${contadores[item].qtde}</label>
                <img src="${contadores[item].icone}" style="width: 25px; height: 25px;">
                
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    <Label style="display: flex; gap: 10px; font-size: 0.8vw;">${contadores[item].label}</label>
                    <label>${dinheiro(contadores[item].valor)}</label>
                </div>
            </div>
            <hr style="width: 100%;">
            `
        }
    }

    var div_titulos = `
    <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; width: 30%;">

        <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento()">
            <label>Novo <strong>Pagamento</strong></label>
        </div>

        <div class="contorno_botoes" style="background-color: #ffffffe3; color: #222; display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: left; margin: 10px;">
            ${titulos}
        </div>
    </div>
    `
    if (especial) {
        return div_titulos
    }

    acumulado += `
    <div id="div_pagamentos">
        <div style="display: flex; justify-content: center; align-items: start; gap: 10px;">
            ${div_titulos}
            <div style="border-radius: 5px; height: 800px; overflow-y: auto;">
                <table id="pagamentos" style="color: #222; font-size: 0.8em; border-collapse: collapse; table-layout: fixed;">
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
    </div>
    `
    var elementus = `
    <div id="pagamentos">
        ${acumulado}
    <div>
    `
    div_pagamentos.innerHTML = elementus

}

function salvar_levantamento(id_orcamento) {

    var elemento = document.getElementById('adicionar_levantamento')
    var file = elemento.files[0];

    if (file) {

        var fileInput = elemento
        var file = fileInput.files[0];
        var fileName = file.name

        if (!file) {
            openPopup_v2('Nenhum arquivo selecionado...');
            return;
        }

        var reader = new FileReader();
        reader.onload = async (e) => {
            var base64 = e.target.result.split(',')[1];
            var mimeType = file.type;

            var response = await fetch('http://localhost:3000/upload', {
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

            var result = await response.json();
            if (response.ok) {

                var anexo = {}
                let id_anexo = gerar_id_5_digitos()
                anexo[id_anexo] = {
                    nome: fileName,
                    formato: mimeType,
                    link: result.fileId
                }

                if (id_orcamento) {
                    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
                    orcamento_v2 = dados_orcamentos[id_orcamento]
                    await enviar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`, anexo)
                    await inserirDados(dados_orcamentos, 'dados_orcamentos')
                    abrir_esquema(id_orcamento)

                } else {
                    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
                    if (!orcamento_v2.levantamentos) {
                        orcamento_v2.levantamentos = {}
                    }
                    orcamento_v2.levantamentos[id_anexo] = anexo
                    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));
                    recuperar_preenchido()

                }

            }

        };

        reader.readAsDataURL(file);
    }
}

async function excluir_levantamento(id_orcamento, id_anexo) {

    let dados_orcamentos = recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcamento]
    delete orcamento.levantamentos[id_anexo]

    await deletar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    abrir_esquema(id_orcamento)

}

async function recuperar_dados_composicoes() {

    inserirDados(await receber('dados_composicoes'), 'dados_composicoes');

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

    elementoTH.insertAdjacentHTML('beforeend', `<img src="imagens/${simbolo}" style="border-radius: 3px; position: absolute; top: 3px; right: 3px; width: 20px; background-color: #222;">`)
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
    const url = `https://leonny.dev.br/dados?chave=${chave}`;

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
        console.error("Erro ao obter dados:", error);
        return null;
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
            body: JSON.stringify({ chave })
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(() => {
                salvar_offline({ chave: chave }, 'deletar')
                resolve();
            });
    });
}

function enviar(caminho, info) {
    return new Promise((resolve) => {
        let objeto = {
            caminho: caminho,
            valor: info
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
            .catch(() => {
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

async function proximo_sequencial() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    var chamados_sequenciais = [0]

    for (orc in dados_orcamentos) {

        var orcamento = dados_orcamentos[orc]
        if (orcamento.dados_orcam && orcamento.dados_orcam.contrato) {
            var chamado = orcamento.dados_orcam.contrato
            if (chamado.slice(0, 4) == 'ORC_') {
                chamados_sequenciais.push(Number(chamado.replace('ORC_', '')))
            }
        }

    }

    var proximo = Math.max(...chamados_sequenciais) + 1

    return proximo

}

function dt() {
    let dt = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    })

    return dt
}

const socket = new WebSocket("wss://leonny.dev.br:8443");

socket.onopen = () => {
    console.log(`🟢🟢🟢 WS ${dt()} 🟢🟢🟢`);
};

socket.onmessage = (event) => {
    let data = JSON.parse(event.data);
    espelhar_atualizacao(data)
    console.log('📢', data);
};

socket.onclose = () => {
    console.log(`🔴🔴🔴 WS ${dt()} 🔴🔴🔴`);
};

socket.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
};

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
                if (!current[keys[i]]) return false;
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
            if (chaves.length === 1) {
                dados[chaves[0]] = valor;
            } else {
                if (!dados[chaves[0]]) {
                    dados[chaves[0]] = {};
                }
                atualizarValor(dados[chaves[0]], chaves.slice(1), valor);
            }
        };
        atualizarValor(dados, chaves, objeto.valor);
    }

    await inserirDados(dados, arquivo);

    if (arquivo === "dados_orcamentos" && document.title === "ORÇAMENTOS") {
        preencher_orcamentos_v2();
    }

    if (arquivo === "dados_composicoes" && document.title === "COMPOSIÇÕES") {
        carregar_tabela_v2();
    }

    if (arquivo === "dados_composicoes" && document.title === "Criar Orçamento") {
        tabela_produtos_v2()
    }

    if (arquivo === "dados_estoque" && document.title === "ESTOQUE") {
        await retomar_paginacao();
    }
}

