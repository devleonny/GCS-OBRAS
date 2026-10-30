// Filtro de seleção com checkbox (montarDropdownCheckbox).
// Nada marcado = sem filtro (o botão mostra "Todos"); marcar opções filtra por elas.
// O que aparece na tela vem sempre do filtro em controles[pag].filtros[path] (grupo OR com
// origem 'dropdown'), inclusive quando outra tela monta o filtro e chama atualizarVisualDropdown.

function garantirControlesDropdown(pag) {
    controles[pag] ??= {};
    controles[pag].filtros ??= {};
}

function regrasAtuaisDropdown(path, pag) {
    const atual = controles?.[pag]?.filtros?.[path];
    if (!atual) return [];
    return Array.isArray(atual) ? [...atual] : [atual];
}

function grupoDropdownAtual(path, pag) {
    const regras = regrasAtuaisDropdown(path, pag);
    return regras.find(r => r?.modo === 'OR' && r?.origem === 'dropdown') || null;
}

function valoresMarcadosDropdown(path, pag) {
    const grupo = grupoDropdownAtual(path, pag);
    return (grupo?.regras || []).map(r => r.value);
}

function opcoesDropdownValidas(opcoes = []) {
    return opcoes
        .filter(o => o && o !== 'todos')
        .sort((a, b) => String(a).localeCompare(String(b)));
}

function limparFiltroDropdown(path, pag, outrasRegras = null) {
    garantirControlesDropdown(pag);

    const regrasBase = Array.isArray(outrasRegras)
        ? outrasRegras
        : regrasAtuaisDropdown(path, pag).filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'));

    if (regrasBase.length === 0) {
        delete controles[pag].filtros[path];
    } else if (regrasBase.length === 1) {
        controles[pag].filtros[path] = regrasBase[0];
    } else {
        controles[pag].filtros[path] = regrasBase;
    }

    if (controles[pag]?.filtros && Object.keys(controles[pag].filtros).length === 0) {
        delete controles[pag].filtros;
    }
}

function salvarFiltroDropdown(path, pag, regrasDropdown = []) {
    garantirControlesDropdown(pag);

    const regras = regrasAtuaisDropdown(path, pag);
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'));

    if (regrasDropdown.length === 0) {
        limparFiltroDropdown(path, pag, outrasRegras);
        return;
    }

    const novoGrupo = {
        modo: 'OR',
        origem: 'dropdown',
        regras: regrasDropdown
    };

    const final = [...outrasRegras, novoGrupo];

    if (final.length === 1) {
        controles[pag].filtros[path] = final[0];
    } else {
        controles[pag].filtros[path] = final;
    }
}

function getDropdownSeletor(path, pag) {
    return `.filtro-dropdown[data-path="${CSS.escape(path)}"][data-pag="${CSS.escape(pag)}"]`;
}

function getDropdownElement(path, pag) {
    return document.querySelector(getDropdownSeletor(path, pag));
}

function labelDropdown(marcados = []) {
    if (marcados.length === 0) return 'Todos';
    if (marcados.length === 1) return marcados[0];
    return `${marcados.length} selecionados`;
}

function opcoesVisiveisDropdown(drop) {
    return [...drop.querySelectorAll('input[data-item="opcao"]')]
        .filter(input => !input.closest('.dropdown-item').hidden);
}

function buscaAtivaDropdown(drop) {
    return !!drop?.querySelector('.dropdown-busca')?.value.trim();
}

// Reflete o filtro atual: checkboxes, texto do botão e ações do topo do menu.
function atualizarVisualDropdown(path, pag) {
    const drop = getDropdownElement(path, pag);
    if (!drop) return;

    const marcados = valoresMarcadosDropdown(path, pag);

    drop.querySelectorAll('input[data-item="opcao"]').forEach(input => {
        input.checked = marcados.includes(input.value);
    });

    const label = drop.querySelector('.dropdown-label');
    if (label) {
        label.textContent = labelDropdown(marcados);
        label.title = label.textContent;
    }

    drop.classList.toggle('com-selecao', marcados.length > 0);
    atualizarAcoesDropdown(drop);
}

// Topo do menu: "Limpar" (com seleção) e, com busca, marcar/desmarcar só as encontradas.
function atualizarAcoesDropdown(drop) {
    const limpar = drop.querySelector('[data-acao="limpar"]');
    const encontrados = drop.querySelector('[data-acao="encontrados"]');
    const marcados = drop.querySelectorAll('input[data-item="opcao"]:checked').length;

    if (limpar) {
        limpar.disabled = marcados === 0;
        limpar.textContent = marcados ? `Limpar (${marcados})` : 'Limpar';
    }

    if (!encontrados) return;

    const visiveis = buscaAtivaDropdown(drop) ? opcoesVisiveisDropdown(drop) : [];
    encontrados.hidden = visiveis.length === 0;

    const todosMarcados = visiveis.length > 0 && visiveis.every(input => input.checked);
    encontrados.dataset.marcar = todosMarcados ? 'N' : 'S';
    encontrados.textContent = `${todosMarcados ? 'Desmarcar' : 'Marcar'} ${visiveis.length === 1 ? 'o encontrado' : `os ${visiveis.length} encontrados`}`;
}

// Marcar várias opções seguidas faz uma consulta só: a tela atualiza na pausa entre cliques
// (ESPERA_FILTRO_DROPDOWN_MS) ou na hora em que o menu fecha.
const ESPERA_FILTRO_DROPDOWN_MS = 600;
const acoesDropdownPendentes = new Map();

function agendarAcaoDropdown(funcao = null, pag = null) {
    const chave = `${pag || ''}|${funcao || ''}`;
    clearTimeout(acoesDropdownPendentes.get(chave)?.timer);
    const timer = setTimeout(() => executarPendenteDropdown(chave), ESPERA_FILTRO_DROPDOWN_MS);
    acoesDropdownPendentes.set(chave, { timer, funcao, pag });
}

function executarPendenteDropdown(chave) {
    const pendente = acoesDropdownPendentes.get(chave);
    if (!pendente) return;
    clearTimeout(pendente.timer);
    acoesDropdownPendentes.delete(chave);
    executarAcaoDropdown(pendente.funcao, pendente.pag).catch(erro => console.error(erro));
}

function executarDropdownsPendentes() {
    for (const chave of [...acoesDropdownPendentes.keys()]) executarPendenteDropdown(chave);
}

async function executarAcaoDropdown(funcao = null, pag = null) {
    if (funcao && typeof window[funcao] === 'function') {
        await window[funcao]();
        return;
    }

    if (pag) {
        await paginacao(pag);
        return;
    }

    await paginacao();
}

// Grava a seleção (vazia = sem filtro) e agenda a consulta.
function aplicarSelecaoDropdown(drop, selecionados) {
    const { path, pag, op = '=', funcao = '' } = drop.dataset;
    garantirControlesDropdown(pag);

    const valores = [...new Set(selecionados)];
    salvarFiltroDropdown(path, pag, valores.map(value => ({ op, value })));

    atualizarVisualDropdown(path, pag);
    agendarAcaoDropdown(funcao || null, pag);
}

function alternarFiltroDropdown(input) {
    const drop = input.closest('.filtro-dropdown');
    const { path, pag } = drop.dataset;
    const atuais = valoresMarcadosDropdown(path, pag).filter(valor => valor !== input.value);
    aplicarSelecaoDropdown(drop, input.checked ? [...atuais, input.value] : atuais);
}

function limparSelecaoDropdown(botao) {
    aplicarSelecaoDropdown(botao.closest('.filtro-dropdown'), []);
}

function alternarEncontradosDropdown(botao) {
    const drop = botao.closest('.filtro-dropdown');
    const { path, pag } = drop.dataset;
    const visiveis = opcoesVisiveisDropdown(drop).map(input => input.value);
    const atuais = valoresMarcadosDropdown(path, pag);

    aplicarSelecaoDropdown(drop, botao.dataset.marcar === 'S'
        ? [...atuais, ...visiveis]
        : atuais.filter(valor => !visiveis.includes(valor)));
}

// Busca dentro do menu (listas longas): esconde as opções que não batem com o texto.
function filtrarOpcoesDropdown(campo) {
    const drop = campo.closest('.filtro-dropdown');
    const termo = normalizarBuscaDropdown(campo.value);
    drop?.querySelectorAll('input[data-item="opcao"]')
        .forEach(input => {
            input.closest('.dropdown-item').hidden = !normalizarBuscaDropdown(input.value).includes(termo);
        });
    if (drop) atualizarAcoesDropdown(drop);
}

function normalizarBuscaDropdown(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Fechar o menu aplica na hora o que ficou pendente e limpa a busca (reabre com a lista toda).
function fecharTodosDropdowns() {
    document.querySelectorAll('.filtro-dropdown .dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
        menu.dataset.aberto = 'N';

        const busca = menu.querySelector('.dropdown-busca');
        if (busca?.value) {
            busca.value = '';
            filtrarOpcoesDropdown(busca);
        }
    });
    executarDropdownsPendentes();
}

// Clique fora de qualquer filtro ou Esc fecham o menu aberto.
document.addEventListener('click', evento => {
    if (!evento.target.closest?.('.filtro-dropdown') && document.querySelector('.filtro-dropdown .dropdown-menu[data-aberto="S"]'))
        fecharTodosDropdowns();
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && document.querySelector('.filtro-dropdown .dropdown-menu[data-aberto="S"]'))
        fecharTodosDropdowns();
});

function toggleDropdown(botao) {
    const drop = botao.closest('.filtro-dropdown');
    const menu = drop?.querySelector('.dropdown-menu');
    if (!menu) return;

    const aberto = menu.dataset.aberto === 'S';

    fecharTodosDropdowns();

    if (!aberto) {
        menu.style.display = 'block';
        menu.dataset.aberto = 'S';
        menu.querySelector('.dropdown-busca')?.focus();
    }
}

function montarDropdownCheckbox({ titulo, op = '=', pag, funcao = null, path, opcoes = [] }) {
    garantirControlesDropdown(pag);

    const atributo = valor => String(valor ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const validas = opcoesDropdownValidas(opcoes);
    const marcados = valoresMarcadosDropdown(path, pag);

    const itens = validas.map(o => `
        <label class="dropdown-item" title="${atributo(o)}">
            <input type="checkbox" data-item="opcao" value="${atributo(o)}"
                ${marcados.includes(o) ? 'checked' : ''} onchange="alternarFiltroDropdown(this)">
            <span class="dropdown-item-texto">${o}</span>
        </label>`).join('');

    const rotulo = labelDropdown(marcados);
    const busca = validas.length > 8
        ? '<input type="search" class="dropdown-busca" placeholder="Buscar..." oninput="filtrarOpcoesDropdown(this)">'
        : '';

    return `
        <div class="campo-pesquisa">
            <label style="color: white;">${titulo}</label>
            <div class="filtro-dropdown ${marcados.length ? 'com-selecao' : ''}"
                data-path="${atributo(path)}" data-pag="${atributo(pag)}" data-op="${atributo(op)}" data-funcao="${atributo(funcao || '')}">
                <div class="filtro-dropdown-botao" onclick="toggleDropdown(this)">
                    <label class="dropdown-label" title="${atributo(rotulo)}">${rotulo}</label>
                    <label class="dropdown-seta">▾</label>
                </div>
                <div class="dropdown-menu" data-aberto="N">
                    <div class="dropdown-topo">
                        ${busca}
                        <div class="dropdown-acoes">
                            <span class="dropdown-dica">Nada marcado = todos</span>
                            <button type="button" data-acao="encontrados" data-marcar="S" hidden
                                onclick="alternarEncontradosDropdown(this)"></button>
                            <button type="button" data-acao="limpar" ${marcados.length ? '' : 'disabled'}
                                onclick="limparSelecaoDropdown(this)">${marcados.length ? `Limpar (${marcados.length})` : 'Limpar'}</button>
                        </div>
                    </div>

                    ${itens || '<span class="dropdown-vazio">Nenhuma opção</span>'}
                </div>
            </div>
        </div>
    `;
}
