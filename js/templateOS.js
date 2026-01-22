const semImagem = `
    <div class="horizontal-1">
        <img src="${api}/uploads/img.png" style="width: 2rem;">
        <span>Sem Imagens</span>
    </div>
`
async function telaOS(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    const cliente = await recuperarDado('dados_clientes', ocorrencia?.unidade)

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

    const modelo = (texto1, texto2) => `
        <div class="vertical">
            <span><b>${texto1}</b></span>
            <span>${texto2}</span>
        </div>
    `

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
                    ${modelo('Status Ocorrência', db.correcoes?.[ocorrencia.tipoCorrecao]?.nome || '')}
                    ${modelo('Prioridade', db.prioridades?.[ocorrencia.prioridade]?.nome || 'Em branco')}
                    ${modelo('Tipo Ocorrência', db.tipos?.[ocorrencia.tipo]?.nome || 'Em branco')}
                    ${modelo('Data/Hora da Abertura', ocorrencia.dataRegistro)}
                </div>

                <div class="vertical">
                    ${modelo('Unidade de Manutenção', cliente?.nome || '')}
                    ${cliente?.cnpj || ''}<br>
                    ${cliente?.bairro || ''}<br>
                    ${cliente?.cidade || ''}<br>
                    ${cliente?.cep || ''}<br>
                </div>

                <div class="vertical">
                    ${modelo('Sistema', db.sistemas?.[ocorrencia.sistema]?.nome || '')}
                    ${modelo('Criado por', ocorrencia?.usuario || '...')}
                </div>

            </div>

        </div>
    `

    let linhasCorrecoes = ''

    for (const correcao of Object.values(ocorrencia?.correcoes || {})) {

        let imagens = ''

        imagens += Object.values(correcao?.fotos || {})
            .map(foto => `<img id="${foto.link}" src="${api}/uploads/${foto.link}" onclick="ampliarImagem(this, '${foto.link}')">`)
            .join('')

        imagens += Object.values(correcao?.anexos || {})
            .map(foto => {
                const link = foto.link
                const extensao = link.split('.').pop().toLowerCase()
                if (!extensoes.includes(extensao)) return ''
                return `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`
            })
            .join('')

        linhasCorrecoes += `
            <div class="painel-2">

                <div class="fotos-os" style="width: 30%;">
                    ${imagens || semImagem}
                </div>

                <div class="vertical" style="width: 100%;">

                    <span><b>Correção</b></span>
                    <div class="campo-descricao" style="width: 70%;">
                        <p>${correcao.descricao}</p>
                    </div>
                    
                    <br>

                    <div class="horizontal" style="gap: 1rem;">
                        ${modelo('Status da Correção', db.correcoes?.[correcao.tipoCorrecao]?.nome || '')}
                        ${modelo('Registrado em', correcao?.data || '--')}
                        ${modelo('Executor', correcao.usuario)}
                    </div>
                </div>

            </div>
        `
    }

    const acumulado = `

        <div id="pdf">
            <div class="botoes-flutuantes">
                <img src="imagens/voltar.png" style="width: 2.5rem;" onclick="telaOcorrencias()">
                <img src="imagens/pdf.png" style="width: 2.5rem;" onclick="gerarPdfOS('${idOcorrencia}')">
            </div>

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

    telaInterna.innerHTML = acumulado

}

async function gerarPdfOS(nome) {

    const id = 'pdf'
    const estilos = [
        'layout_os'
    ]

    await pdf({ id, estilos, nome })
}
