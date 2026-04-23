// Glossário e contexto do usuário para orientar o ai-polish.
// Fonte única da verdade: editar aqui, commitar e fazer deploy.
//
// Formato:
//   contexto  — frase curta sobre o usuário (cargo, domínio).
//   glossario — lista { sigla, significado }. O modelo é instruído
//               a NÃO alterar/expandir/corrigir essas siglas nos
//               títulos/descrições, apenas a entendê-las.

module.exports = {
  contexto:
    "Auditor fiscal da Receita Estadual de Mato Grosso do Sul (SEFAZ-MS), coordenador da COFIT. Atua como ponte entre as unidades de fiscalização (UFIPVA e UFITCD), a SAT e a COTIN.",

  glossario: [
    { sigla: "COFIT", significado: "Coordenadoria de Fiscalização do IPVA e do ITCD" },
    { sigla: "SAT", significado: "Superintendência de Administração Tributária" },
    { sigla: "UFIPVA", significado: "Unidade de Fiscalização do IPVA" },
    { sigla: "UFITCD", significado: "Unidade de Fiscalização do ITCD" },
    { sigla: "COTIN", significado: "Coordenadoria de Tecnologia da Informação" },
    { sigla: "UGSIS-Cred", significado: "Unidade de Gestão de Sistemas de Crédito Tributário, Arrecadação e Outros Tributos" },
    { sigla: "CELEG", significado: "Coordenadoria de Legislação da SEFAZ-MS" },
    { sigla: "DIT", significado: "Declaração de ITCD" },
    { sigla: "CRD", significado: "Sistema de Gestão de Créditos Tributários" },
    { sigla: "IPVA", significado: "Imposto sobre a Propriedade de Veículos Automotores" },
    { sigla: "ITCD", significado: "Imposto sobre Transmissão Causa Mortis e Doação" },
    { sigla: "SLI", significado: "Superintendência de Logística e Infraestrutura" },
    { sigla: "SUAD", significado: "Superintendência de Administração" },
  ],
};
