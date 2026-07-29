  ### 2. Prompt para Otimização de Leitura (Read Path)

  │ Objetivo: Refatorar consultas SQL, criar índices estratégicos e aplicar caching com proteção contra Cache Stampede.

    Com base na Seção 2 do guia skills/guia_otimizacao_leitura_escrita_web.md, refatore as rotas/consultas de leitura do arquivo [CAMINHO_DO_ARQUIVO]:
    
    Requisitos de Refatoração:
    1. Substitua `SELECT *` por projeção explícita de colunas necessárias.
    2. Escreva as DDLs para criação de Covering Indexes (com a cláusula INCLUDE se relacional) para as queries mais frequentes.
    3. Se houver paginação com OFFSET elevado, refatore para Cursor/Keyset-based pagination.
    4. Implemente o padrão Cache-Aside com suporte a Singleflight/Mutex para evitar Cache Stampede na chave [NOME_DA_CHAVE].
    5. Mostre o diff do código refatorado e as consultas SQL resultantes.

  ### 4. Prompt para Divisão Read/Write Router & Connection Pooling

  │ Objetivo: Separar tráfego de réplicas de leitura e nó primário de escrita.

    Implemente um Roteador de Banco de Dados (Read/Write Router) no arquivo [CAMINHO_DO_DATABASE_CONFIG] seguindo o padrão descrito no snippet 3 do guia
  skills/guia_otimizacao_leitura_escrita_web.md.

    Requisitos:
    1. Encaminhe queries mutáveis (`INSERT`, `UPDATE`, `DELETE`, `SELECT FOR UPDATE`) para o Primary Pool.
    2. Encaminhe queries puras de leitura (`SELECT`) para o Replica Pool.
    3. Configure o tamanho máximo do pool com base na fórmula de HikariCP: Connections = (CPU_CORES * 2) + DISK_SPINDLES.
    4. Inclua suporte a fallback para o Primary em caso de indisponibilidade da réplica.