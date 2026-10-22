const semImagem = `
    <div class="horizontal-1">
        <img src="${api}/uploads/img.png" style="width: 2rem;">
        <span>Sem Imagens</span>
    </div>
`
// Monta o HTML da OS do chamado. Usado na tela (telaOS) e no PDF direto (baixarPdfOS).
async function montarOS(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const cliente = await recuperarDado('clientes', ocorrencia?.unidade) || {}
    const { tipo, sistema, prioridade, nomesStatus } = ocorrencia?.snapshots || {}

    const labelTipoCorrecao = (nomesStatus || [])
        .filter(st => st !== 'PAGAMENTO DE PARCEIRO')
        .map(st => formatacaoTipoCorrecao(st))
        .join('')

    let assinatura = ''

    if (ocorrencia.assinatura) {
        assinatura = `
            <br>
            <span>Assinatura do Cliente/Responsável</span><br>
            <img style="width: 15rem;" src="${api}/uploads/${ocorrencia.assinatura}">
        `
    }

    let imagens = ''

    imagens += Object.values(ocorrencia?.fotos || {})
        .map(foto => {
            return `<img id="${foto.link}" src="${api}/uploads/${foto.link}" onclick="ampliarImagem(this, '${foto.link}')">`
        })
        .join('')

    // Anexos
    imagens += Object.values(ocorrencia?.anexos || {})
        .map(foto => {
            const link = foto.link
            const extensao = link.split('.').pop().toLowerCase()
            if (!extensoes.includes(extensao)) return ''
            return `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`
        })
        .join('')

    const modelo = (texto1, texto2) => {

        if (!texto2)
            return ''

        return `
        <div class="vertical">
            <span><b>${texto1}</b></span>
            <span>${texto2}</span>
        </div>
    `}

    const descFinal = ocorrencia.descricao || 'Sem comentários'
    const linha1 = `
        <div class="painel-1">

            <div class="painel-0">
                <b>Chamado nº ${idOcorrencia}:</b> ${descFinal.replace('\n', '<br>')}
            </div>

            <div class="horizontal-2">

                <div class="fotos-os">
                    ${imagens || semImagem}
                </div>

                <div class="vertical">
                    ${modelo('Status Ocorrência', labelTipoCorrecao)}
                    ${modelo('Prioridade', prioridade)}
                    ${modelo('Tipo Ocorrência', tipo)}
                    ${modelo('Data/Hora da Abertura', ocorrencia.data_registro)}
                </div>

                <div class="vertical">
                    ${modelo('Unidade de Manutenção', cliente?.nome)}
                    ${[cliente?.cnpj, cliente?.bairro, cliente?.cidade, cliente?.cep]
                        .filter(Boolean)
                        .map(dado => `<span>${dado}</span>`)
                        .join('')}
                </div>

                <div class="vertical">
                    ${modelo('Sistema', sistema)}
                    ${modelo('Criado por', ocorrencia?.usuario)}
                </div>

            </div>

            ${Object.keys(ocorrencia?.equipamentos || {}).length
                ? `<div class="os-equipamentos-chamado">${tabEquipamentos(ocorrencia.equipamentos)}</div>`
                : ''}

        </div>
    `
    const promessasCorrecoes = Object.values(
        ocorrencia?.correcoes || {}
    )
    .filter(correcao => correcao.tipoCorrecao !== '24e1ea27-1bd8-451a-b5bf-edda134cfdd6')
    .map(async (correcao) => {
        const {
            equipamentos,
            fotos,
            anexos,
            data,
            usuario,
            tecnico,
            tipoCorrecao,
            descricao
        } = correcao


        const { nome } = await recuperarDado('correcoes', tipoCorrecao) || {}


        const tEquipamentos = equipamentos
            ? tabEquipamentos(equipamentos, idOcorrencia)
            : ''


        const imagensFotos = Object.values(fotos || {})
            .map(foto => {
                if (!foto?.link) return ''


                return `
                <img
                    id="${foto.link}"
                    src="${api}/uploads/${foto.link}"
                    onclick="ampliarImagem(this, '${foto.link}')"
                >
            `
            })
            .join('')


        const imagensAnexos = Object.values(anexos || {})
            .map(foto => {
                const link = foto?.link


                if (!link) return ''


                const extensao = link.split('.').pop().toLowerCase()


                if (!extensoes.includes(extensao)) return ''


                return `
                <img
                    name="foto"
                    id="${link}"
                    src="${api}/uploads/${link}"
                    onclick="ampliarImagem(this, '${link}')"
                >
            `
            })
            .join('')


        const imagens = imagensFotos + imagensAnexos


        return `
        <div class="painel-2">
            <div class="fotos-os" style="width: 30%;">
                ${imagens || semImagem}
            </div>


            <div class="vertical" style="width: 100%; gap: 0.5rem;">
                <span><b>Correção</b></span>


                <div class="campo-descricao">
                    <p>${descricao || 'Sem descrição'}</p>
                </div>


                ${tEquipamentos}


                <div class="horizontal" style="gap: 1rem;">
                    ${modelo('Status da Correção', nome)}
                    ${modelo('Registrado em', data)}
                    ${modelo('Executor', usuario)}
                    ${modelo('Técnico', tecnico)}
                </div>
            </div>
        </div>
    `
    })

    const linhasCorrecoes = (
        await Promise.all(promessasCorrecoes)
    ).join('')

    // Só o conteúdo: os botões da tela ficam fora, para não irem parar no PDF.
    return `
        <div id="pdf" class="os-chamado">
            <div class="relatorio">

                <div class="corpo">

                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="titulo-os">Relatório da Ocorrência</span>
                        <img src="https://i.imgur.com/gUcc7iG.png" style="width: 3rem;">
                    </div>
                    <br>
                    <div class="painel">

                        ${linha1}

                        ${linhasCorrecoes}

                        ${assinatura}

                    </div>

                </div>

            </div>
        </div>
    `
}

const ESTILOS_PDF_OS = ['gcsobras', 'relatorio', 'layout_os']

async function telaOS(idOcorrencia) {

    overlayAguarde()

    tela.innerHTML = `
        <div class="botoes-flutuantes">
            <img src="imagens/voltar.png" style="width: 2.5rem;" onclick="telaOcorrencias()">
            <img src="imagens/pdf.png" style="width: 2.5rem;" onclick="gerarPdfOS('${idOcorrencia}')">
        </div>
        ${await montarOS(idOcorrencia)}
    `

    removerOverlay()

}

async function gerarPdfOS(nome) {

    await pdf({ id: 'pdf', estilos: ESTILOS_PDF_OS, nome, orientacao: 'landscape' })

}

// Gera e baixa o PDF da OS sem abrir a tela do relatório.
async function baixarPdfOS(idOcorrencia) {

    try {
        overlayAguarde()
        await pdf({ html: await montarOS(idOcorrencia), estilos: ESTILOS_PDF_OS, nome: idOcorrencia, orientacao: 'landscape' })
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao gerar o PDF da OS: Fale com o suporte.' })
    }

}
