function garantirControlesDropdown(pag) {
    controles[pag] ??= {};
    controles[pag].filtros ??= {};
    controles[pag].dropdownEstado ??= {};
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

function getEstadoVisualDropdown(path, pag) {
    return controles?.[pag]?.dropdownEstado?.[path] || null; // 'todos' | 'nenhum' | 'parcial' | null
}

function setEstadoVisualDropdown(path, pag, estado) {
    garantirControlesDropdown(pag);
    controles[pag].dropdownEstado[path] = estado;
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

function getOpcoesDropdownDOM(path, pag) {
    const drop = getDropdownElement(path, pag);
    if (!drop) return [];

    return [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')];
}

function getValoresOpcoesDropdownDOM(path, pag) {
    return getOpcoesDropdownDOM(path, pag).map(input => input.value);
}

function tudoMarcadoDropdown(path, opcoes = [], pag) {
    const validas = opcoesDropdownValidas(opcoes);
    const estado = getEstadoVisualDropdown(path, pag);

    if (estado === 'todos') return true;
    if (estado === 'nenhum') return false;

    const marcados = valoresMarcadosDropdown(path, pag);

    if (validas.length > 0 && marcados.length === 0) return true;

    return validas.length > 0 && validas.every(o => marcados.includes(o));
}

function nadaMarcadoDropdown(path, opcoes = [], pag) {
    const validas = opcoesDropdownValidas(opcoes);
    const estado = getEstadoVisualDropdown(path, pag);

    if (estado === 'nenhum') return validas.length > 0;
    if (estado === 'todos') return false;

    const marcados = valoresMarcadosDropdown(path, pag);
    return validas.length > 0 && marcados.length === 0 && estado === 'nenhum';
}

function labelDropdown(path, pag, opcoes = []) {
    const total = opcoesDropdownValidas(opcoes).length;
    const estado = getEstadoVisualDropdown(path, pag);
    const marcados = valoresMarcadosDropdown(path, pag);

    if (estado === 'todos' || (estado === null && marcados.length === 0)) {
        return 'Selecionar';
    }

    if (estado === 'nenhum') {
        return 'Nenhum';
    }

    if (marcados.length === 0) return 'Selecionar';
    if (marcados.length === 1) return marcados[0];

    if (total > 0 && marcados.length === total) {
        return 'Selecionar';
    }

    return `${marcados.length} selecionados`;
}

function atualizarVisualDropdown(path, pag) {
    const drop = getDropdownElement(path, pag);
    if (!drop) return;

    const checkboxes = [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')];
    const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]');
    const label = drop.querySelector('.dropdown-label');

    const validas = checkboxes.map(input => input.value);
    const estado = getEstadoVisualDropdown(path, pag);
    const marcados = valoresMarcadosDropdown(path, pag);

    if (estado === 'todos' || (estado === null && marcados.length === 0)) {
        checkboxes.forEach(input => {
            input.checked = true;
        });

        if (checkTodos) {
            checkTodos.checked = true;
            checkTodos.indeterminate = false;
        }
    } else if (estado === 'nenhum') {
        checkboxes.forEach(input => {
            input.checked = false;
        });

        if (checkTodos) {
            checkTodos.checked = false;
            checkTodos.indeterminate = false;
        }
    } else {
        checkboxes.forEach(input => {
            input.checked = marcados.includes(input.value);
        });

        if (checkTodos) {
            const totalMarcados = marcados.length;
            const total = validas.length;

            checkTodos.checked = total > 0 && totalMarcados === total;
            checkTodos.indeterminate = totalMarcados > 0 && totalMarcados < total;
        }
    }

    if (label) {
        label.textContent = labelDropdown(path, pag, validas);
    }
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

async function alternarTodosDropdown(path, opcoes = [], pag, funcao = null) {
    garantirControlesDropdown(pag);

    const validas = opcoesDropdownValidas(opcoes);
    if (validas.length === 0) return;

    const estadoAtual = getEstadoVisualDropdown(path, pag);
    const estaTudoMarcado = estadoAtual === 'todos' || (estadoAtual === null && valoresMarcadosDropdown(path, pag).length === 0);

    if (estaTudoMarcado) {
        setEstadoVisualDropdown(path, pag, 'nenhum');
        limparFiltroDropdown(path, pag);
    } else {
        setEstadoVisualDropdown(path, pag, 'todos');
        limparFiltroDropdown(path, pag);
    }

    atualizarVisualDropdown(path, pag);
    await executarAcaoDropdown(funcao, pag);
}

async function alternarFiltroDropdown(marcado, strg) {
    const {
        path,
        valor,
        pag,
        funcao = null,
        op
    } = JSON.parse(decodeURIComponent(strg));

    garantirControlesDropdown(pag);

    const validas = opcoesDropdownValidas(getValoresOpcoesDropdownDOM(path, pag));
    if (validas.length === 0) return;

    const estadoAtual = getEstadoVisualDropdown(path, pag);
    const grupoAtual = grupoDropdownAtual(path, pag);

    let selecionados = [];

    if (estadoAtual === 'todos' || (estadoAtual === null && valoresMarcadosDropdown(path, pag).length === 0)) {
        selecionados = [...validas];
    } else if (estadoAtual === 'nenhum') {
        selecionados = [];
    } else {
        selecionados = [...(grupoAtual?.regras || [])].map(r => r.value);
    }

    selecionados = selecionados.filter(v => v !== valor);

    if (marcado) {
        selecionados.push(valor);
    }

    selecionados = [...new Set(selecionados)];

    const total = validas.length;
    const qtd = selecionados.length;
    const selecionouTodas = total > 0 && qtd === total;
    const selecionouNenhuma = qtd === 0;

    if (selecionouTodas) {
        setEstadoVisualDropdown(path, pag, 'todos');
        limparFiltroDropdown(path, pag);
    } else if (selecionouNenhuma) {
        setEstadoVisualDropdown(path, pag, 'nenhum');
        limparFiltroDropdown(path, pag);
    } else {
        setEstadoVisualDropdown(path, pag, 'parcial');
        salvarFiltroDropdown(
            path,
            pag,
            selecionados.map(value => ({ op, value }))
        );
    }

    atualizarVisualDropdown(path, pag);
    await executarAcaoDropdown(funcao, pag);
}

function fecharTodosDropdowns() {
    document.querySelectorAll('.filtro-dropdown .dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
        menu.dataset.aberto = 'N';
    });
}

function toggleDropdown(botao) {
    const drop = botao.closest('.filtro-dropdown');
    const menu = drop?.querySelector('.dropdown-menu');
    if (!menu) return;

    const aberto = menu.dataset.aberto === 'S';

    fecharTodosDropdowns();

    if (!aberto) {
        menu.style.display = 'block';
        menu.dataset.aberto = 'S';
    }
}

function montarDropdownCheckbox({ titulo, op = '=', pag, funcao = null, path, opcoes = [] }) {
    garantirControlesDropdown(pag);

    const validas = opcoesDropdownValidas(opcoes);
    const estado = getEstadoVisualDropdown(path, pag);
    const marcados = valoresMarcadosDropdown(path, pag);

    const todosAtivos = estado === 'todos' || (estado === null && marcados.length === 0);
    const nenhumAtivo = estado === 'nenhum';

    const itens = validas.map(o => {
        const dados = {
            op,
            path,
            valor: o,
            pag,
            funcao
        };

        let checked = false;

        if (todosAtivos) {
            checked = true;
        } else if (nenhumAtivo) {
            checked = false;
        } else {
            checked = marcados.includes(o);
        }

        return `
        <label class="dropdown-item">
            <input
                type="checkbox"
                data-item="opcao"
                value="${String(o).replace(/"/g, '&quot;')}"
                ${checked ? 'checked' : ''}
                onchange="alternarFiltroDropdown(this.checked, '${encodeURIComponent(JSON.stringify(dados))}')">
            <span>${o}</span>
        </label>
        `;
    }).join('');

    return `
        <div class="campo-pesquisa">
            <span style="color: white;">${titulo}</span>
            <div class="filtro-dropdown" data-path="${path}" data-pag="${pag}">
                <div class="filtro-dropdown-botao" onclick="toggleDropdown(this)">
                    <span class="dropdown-label">${labelDropdown(path, pag, validas)}</span>
                    <span>▾</span>
                </div>
                <div class="dropdown-menu" data-aberto="N">
                    <label class="dropdown-item" style="border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 6px;">
                        <input
                            type="checkbox"
                            data-item="todos"
                            ${todosAtivos ? 'checked' : ''}
                            onchange="alternarTodosDropdown('${path.replace(/'/g, "\\'")}', ${JSON.stringify(validas).replace(/"/g, '&quot;')}, '${pag.replace(/'/g, "\\'")}'${funcao ? `, '${funcao.replace(/'/g, "\\'")}'` : ''})">
                        <span>Todos</span>
                    </label>

                    ${itens || '<span>Nenhuma opção</span>'}
                </div>
            </div>
        </div>
    `;
}