// Tours de primeira vez das telas (js/tour.js): Ocorrências e Histórico do Orçamento (28/11/2026).
// Aparecem sozinhos uma vez por usuário (preferência tour_<id>); o botão "Tour" de cada tela reabre.

// ---------------------------------------------------------------- Ocorrências

// Primeiro chamado da lista (cada chamado é uma linha da tabela).
const primeiroChamadoTour = () => document.querySelector('#bodyOcorrencias > tr')
// Elemento visível dentro do primeiro chamado (abas escondidas ficam de fora); sem ele, procura nos outros chamados.
const noChamadoTour = seletor => () => {
    const visivel = lista => [...lista].find(el => el.offsetParent !== null) || null
    return visivel(primeiroChamadoTour()?.querySelectorAll(seletor) || [])
        || visivel(document.querySelectorAll(`#bodyOcorrencias ${seletor}`))
}

const TOUR_OCORRENCIAS = [
    {
        titulo: 'Bem-vindo às Ocorrências',
        texto: '<p>Aqui ficam os chamados: cada um com os dados, os orçamentos ligados e o fluxo das correções.</p><p>Em poucos passos mostramos como a tela funciona. Dá para pular a qualquer momento e rever depois pelo botão <b>Tour</b>.</p>'
    },
    {
        alvo: '#ocorrencias-painel-pesquisas',
        titulo: 'Pesquisa e filtros',
        texto: '<p>Pesquise pelo chamado, unidade, descrição ou autorização e filtre por criador, gestor, status, técnico, empresa, tags, datas e atrasados.</p><p>O <b>mapa</b> conta os chamados por estado e filtra com um clique. As <b>visões</b> guardam combinações de filtros prontas.</p>'
    },
    {
        alvo: noChamadoTour('.div-linha'),
        titulo: 'Chamados',
        texto: '<p>Cada bloco é um chamado. À esquerda fica o <b>cartão principal</b>, com os dados do chamado; à direita, o <b>cartão secundário</b>, com as correções.</p>'
    },
    {
        alvo: noChamadoTour('.div-linha > .bloco-linha:first-child'),
        titulo: 'Cartão principal',
        texto: '<p>Unidade, endereço, descrição, quem criou, gestor responsável, empresa, tipo, sistema, prioridade, anexos e fotos do chamado.</p>'
    },
    {
        alvo: noChamadoTour('.arvore-orcamentos'),
        titulo: 'Orçamentos do chamado',
        texto: '<p>O orçamento <b>principal</b> fica em cima, em laranja, e os <b>vinculados</b> (aditivos, complementos) ficam pendurados nele, cada um com o seu status.</p><p>Clicar num orçamento deixa só as abas dele; clicar de novo mostra todas. A lupa abre os atalhos e a pasta abre o histórico do orçamento.</p>'
    },
    {
        alvo: noChamadoTour('.chamado-acoes'),
        titulo: 'Ações do chamado',
        texto: '<p>Excluir, editar, baixar a <b>OS</b> em PDF, marcar <b>Busca de técnico</b> e <b>Criar orçamento</b> para este chamado.</p>'
    },
    {
        alvo: noChamadoTour('.div-linha > #correcoes'),
        titulo: 'Cartão secundário',
        texto: '<p>Tudo o que aconteceu no chamado: a garantia, os fluxos em abas e as correções de cada fluxo, da mais recente para a mais antiga.</p>'
    },
    {
        alvo: noChamadoTour('.toolbar-correcao'),
        titulo: 'Fluxos',
        texto: '<p>Cada <b>aba</b> é um fluxo do chamado, com o status atual no rótulo. Num chamado com orçamentos vinculados, a aba mostra de qual orçamento é o fluxo.</p><p>As setinhas passam as abas quando não cabem.</p>'
    },
    {
        alvo: noChamadoTour('.aba-novo-fluxo'),
        titulo: 'Novo fluxo',
        texto: '<p>Abre uma aba nova para um trabalho que corre à parte. Com vinculados, você escolhe de qual orçamento é o fluxo: o status conta só para ele.</p>'
    },
    {
        alvo: noChamadoTour('.botao-correcao'),
        titulo: 'Nova correção',
        texto: '<p><b>Incluir Correção</b> registra o próximo passo do fluxo desta aba: o que foi feito, quando, quem executa e o que falta.</p>'
    },
    {
        alvo: noChamadoTour('.detalhes-correcoes-1'),
        titulo: 'Cartão da correção',
        texto: '<p>No topo, o <b>status</b> com quem lançou e quando. No meio, datas, turno, permissão, executores, técnicos e descrição. No rodapé, editar, reagendar, anexar e as fotos.</p><p>A faixa da esquerda segue a cor do status.</p>'
    },
    {
        alvo: noChamadoTour('.correcao-topo'),
        titulo: 'Status e fila',
        texto: '<p>O <b>status</b> da última correção é o status da aba; ele também vira o status do chamado e do orçamento.</p><p>A <b>Permissão</b> escolhida na correção é a <b>fila</b>: a pendência aparece para quem tem essa permissão (ou só para o gestor responsável do chamado, se houver) e para os executores.</p>'
    },
    {
        alvo: '[data-tour-ocorrencias]',
        titulo: 'Pronto!',
        texto: '<p>Para ver este passo a passo de novo, é só clicar em <b>Tour</b>.</p>'
    }
]

// Botão "Tour" no topo da tabela de chamados (ao lado da paginação).
function botaoTourOcorrencias() {
    if (document.querySelector('[data-tour-ocorrencias]')) return
    document.querySelector('.tela-ocorrencias .modtab > .topo-tabela > [id^="paginacao_"]')
        ?.insertAdjacentHTML('afterend', `<button type="button" class="tour-botao" data-tour-ocorrencias
            onclick="iniciarTour('ocorrencias', TOUR_OCORRENCIAS)" title="Passo a passo das principais ferramentas desta tela">${iconeTour()} Tour</button>`)
}

// ---------------------------------------------------------------- Histórico do Orçamento

const noHistoricoTour = seletor => () => document.querySelector(`body > .popup .painel-historico ${seletor}`)
// Seções e Esquema são visões diferentes: os passos das seções voltam para "Seções".
// (sem gravar a preferência do usuário: só mostra).
const mostrarSecoesTour = async () => {
    const painel = noHistoricoTour('')()?.closest('.painel-historico') || document.querySelector('body > .popup .painel-historico')
    if (!painel || painel.dataset.visao === 'secoes') return
    painel.dataset.visao = 'secoes'
    painel.querySelectorAll('[data-visao-opcao]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.visaoOpcao === 'secoes')))
    painel.querySelector('.bloco-st').hidden = false
    painel.querySelector('.bloco-esquema-historico').hidden = true
    await carregarVisaoHistorico(painel, 'secoes')
}
const secaoHistoricoTour = chave => noHistoricoTour(`.historico-secao[data-secao="${chave}"]`)

const TOUR_HISTORICO = [
    {
        titulo: 'Histórico do Orçamento',
        texto: '<p>Tudo o que nasceu deste orçamento num lugar só: chamado, status, pedidos, requisições, notas, documentos e pagamentos de parceiro.</p><p>Dá para pular a qualquer momento e rever depois pelo botão <b>Tour</b>.</p>'
    },
    {
        alvo: noHistoricoTour('.historico-resumo'),
        titulo: 'Resumo',
        texto: '<p><b>Chamado</b>: se já foi aberto (ou, no vinculado, em qual chamado o fluxo dele anda). <b>Status</b>: o status atual do orçamento. <b>Liberação</b>: se tem pedido ou foi liberado sem pedido (POC, garantia, uso interno).</p>'
    },
    {
        alvo: noHistoricoTour('.historico-visao'),
        titulo: 'Seções ou Esquema',
        texto: '<p><b>Seções</b> mostra cada assunto numa caixa. <b>Esquema</b> mostra cada pedido com as requisições e notas que nasceram dele. A escolha fica salva para a próxima vez.</p>'
    },
    {
        alvo: secaoHistoricoTour('pedidos'),
        antes: mostrarSecoesTour,
        titulo: 'Pedidos',
        texto: '<p>Os pedidos do cliente (OC, aprovado por e-mail ou pendente). O botão <b>Novo Pedido</b> lança um pedido para este orçamento.</p>'
    },
    {
        alvo: secaoHistoricoTour('requisicoes'),
        antes: mostrarSecoesTour,
        titulo: 'Requisições',
        texto: '<p>As requisições de materiais do orçamento. <b>Requisição de Materiais</b> cria uma nova: precisa de pedido ou de liberação.</p>'
    },
    {
        alvo: secaoHistoricoTour('notas'),
        antes: mostrarSecoesTour,
        titulo: 'Notas',
        texto: '<p>As notas fiscais do orçamento, emitidas pelo GCS ou importadas. Aqui é só consulta: a nota entra pela emissão.</p>'
    },
    {
        alvo: secaoHistoricoTour('levantamentos'),
        antes: mostrarSecoesTour,
        titulo: 'Documentos',
        texto: '<p><b>Levantamentos</b> e <b>Finalizações</b> guardam os documentos do orçamento: o que foi levantado antes e o que comprova a entrega.</p>'
    },
    {
        alvo: secaoHistoricoTour('parceiros'),
        antes: mostrarSecoesTour,
        titulo: 'LPU Parceiro',
        texto: '<p>Os pagamentos de parceiros deste orçamento, pela LPU do parceiro. <b>LPU Parceiro</b> lança um novo, que segue para aprovação.</p>'
    },
    {
        alvo: noHistoricoTour('.historico-ver-status'),
        titulo: 'Histórico de status',
        texto: '<p>A linha do tempo dos status do orçamento: quando mudou e quem mudou.</p>'
    },
    {
        alvo: noHistoricoTour('[data-tour-historico]'),
        titulo: 'Pronto!',
        texto: '<p>Para ver este passo a passo de novo, é só clicar em <b>Tour</b>.</p>'
    }
]

// ---------------------------------------------------------------- comum

function iconeTour() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5"/><path d="M12 17h.01"/></svg>'
}
