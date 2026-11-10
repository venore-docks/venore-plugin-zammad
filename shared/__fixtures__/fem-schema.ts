// Recorte REAL do Zammad da FEM (colabora.fem.edu.br, 7.2.2) em 2026-11-10: grupos, atributos de ticket e
// Core Workflows. Sem dados pessoais. Usado só nos testes — se o Zammad mudar, os testes continuam valendo
// para este recorte.
import type { ZammadSchema } from "../../contracts/zammad";

export const FEM_SCHEMA: ZammadSchema = {
  "groups": [
    {
      "id": 1,
      "name": "Manutenção",
      "name_last": "Manutenção",
      "parent_id": null,
      "active": true,
      "note": "Grupo para Tickets da Manutenção"
    },
    {
      "id": 2,
      "name": "Tecnologia",
      "name_last": "Tecnologia",
      "parent_id": null,
      "active": true,
      "note": "Grupo para Tickets da Tecnologia"
    },
    {
      "id": 3,
      "name": "Sugestões para o sistema",
      "name_last": "Sugestões para o sistema",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 4,
      "name": "Inspetoria",
      "name_last": "Inspetoria",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 5,
      "name": "Zeladoria",
      "name_last": "Zeladoria",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 6,
      "name": "Marketing",
      "name_last": "Marketing",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 7,
      "name": "Eventos",
      "name_last": "Eventos",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 8,
      "name": "Eventos::Cobertura fotográfica",
      "name_last": "Cobertura fotográfica",
      "parent_id": 7,
      "active": true,
      "note": null
    },
    {
      "id": 9,
      "name": "Eventos::Som e Projeção",
      "name_last": "Som e Projeção",
      "parent_id": 7,
      "active": true,
      "note": null
    },
    {
      "id": 10,
      "name": "Tutoria",
      "name_last": "Tutoria",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 11,
      "name": "Recursos Humanos - Dúvidas",
      "name_last": "Recursos Humanos - Dúvidas",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 12,
      "name": "Investimentos (Gestores)",
      "name_last": "Investimentos (Gestores)",
      "parent_id": null,
      "active": true,
      "note": null
    },
    {
      "id": 13,
      "name": "Registro de Ocorrências",
      "name_last": "Registro de Ocorrências",
      "parent_id": null,
      "active": true,
      "note": null
    }
  ],
  "attributes": [
    {
      "name": "number",
      "object": "Ticket",
      "display": "#",
      "data_type": "input",
      "active": true,
      "editable": false,
      "position": 5,
      "data_option": {
        "display_config": "ticket_hook",
        "type": "text",
        "readonly": 1,
        "null": true,
        "maxlength": 60,
        "width": "68px"
      },
      "screens": {
        "create_middle": {}
      }
    },
    {
      "name": "title",
      "object": "Ticket",
      "display": "Title",
      "data_type": "input",
      "active": true,
      "editable": false,
      "position": 8,
      "data_option": {
        "type": "text",
        "maxlength": 200,
        "null": false,
        "translate": false
      },
      "screens": {
        "create_middle": {}
      }
    },
    {
      "name": "customer_id",
      "object": "Ticket",
      "display": "Customer",
      "data_type": "user_autocompletion",
      "active": true,
      "editable": false,
      "position": 10,
      "data_option": {
        "relation": "User",
        "autocapitalize": false,
        "multiple": false,
        "guess": true,
        "null": false,
        "limit": 200,
        "placeholder": "Enter Person or Organization/Company",
        "minLengt": 2,
        "translate": false,
        "permission": [
          "ticket.agent",
          "ticket.customer"
        ]
      },
      "screens": {
        "create_middle": {}
      }
    },
    {
      "name": "organization_id",
      "object": "Ticket",
      "display": "Organization",
      "data_type": "autocompletion_ajax_customer_organization",
      "active": true,
      "editable": false,
      "position": 12,
      "data_option": {
        "relation": "Organization",
        "autocapitalize": false,
        "multiple": false,
        "null": true,
        "translate": false,
        "permission": [
          "ticket.agent",
          "ticket.customer"
        ]
      },
      "screens": {
        "create_middle": {}
      }
    },
    {
      "name": "type",
      "object": "Ticket",
      "display": "Type",
      "data_type": "select",
      "active": false,
      "editable": true,
      "position": 20,
      "data_option": {
        "default": "",
        "options": {
          "Incident": "Incident",
          "Problem": "Problem",
          "Request for Change": "Request for Change"
        },
        "nulloption": true,
        "multiple": false,
        "null": true,
        "translate": true,
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "-all-": {
            "null": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "group_id",
      "object": "Ticket",
      "display": "Group",
      "data_type": "tree_select",
      "active": true,
      "editable": false,
      "position": 25,
      "data_option": {
        "default": "",
        "relation": "Group",
        "relation_condition": {
          "access": "full"
        },
        "nulloption": true,
        "multiple": false,
        "null": false,
        "translate": false,
        "only_shown_if_selectable": true,
        "permission": [
          "ticket.agent",
          "ticket.customer"
        ],
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "-all-": {
            "null": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "owner_id",
      "object": "Ticket",
      "display": "Owner",
      "data_type": "select",
      "active": true,
      "editable": false,
      "position": 30,
      "data_option": {
        "default": "",
        "relation": "User",
        "relation_condition": {
          "roles": "Agent"
        },
        "nulloption": true,
        "multiple": false,
        "null": true,
        "translate": false,
        "permission": [
          "ticket.agent"
        ],
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "-all-": {
            "null": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "state_id",
      "object": "Ticket",
      "display": "State",
      "data_type": "select",
      "active": true,
      "editable": false,
      "position": 40,
      "data_option": {
        "relation": "TicketState",
        "nulloption": true,
        "multiple": false,
        "null": false,
        "default": 2,
        "translate": true,
        "filter": [
          1,
          2,
          3,
          4,
          6,
          7
        ],
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "ticket.agent": {
            "null": false,
            "item_class": "column",
            "filter": [
              1,
              2,
              3,
              4,
              6,
              7
            ]
          },
          "ticket.customer": {
            "item_class": "column",
            "nulloption": false,
            "null": true,
            "filter": [
              1,
              4
            ],
            "default": 1
          }
        }
      }
    },
    {
      "name": "pending_time",
      "object": "Ticket",
      "display": "Pending till",
      "data_type": "datetime",
      "active": true,
      "editable": false,
      "position": 41,
      "data_option": {
        "future": true,
        "past": false,
        "diff": null,
        "null": true,
        "translate": true,
        "permission": [
          "ticket.agent"
        ]
      },
      "screens": {
        "create_middle": {
          "-all-": {
            "null": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "priority_id",
      "object": "Ticket",
      "display": "Priority",
      "data_type": "select",
      "active": true,
      "editable": false,
      "position": 80,
      "data_option": {
        "relation": "TicketPriority",
        "nulloption": false,
        "multiple": false,
        "null": false,
        "default": 2,
        "translate": true,
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "ticket.agent": {
            "null": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "tags",
      "object": "Ticket",
      "display": "Tags",
      "data_type": "tag",
      "active": true,
      "editable": false,
      "position": 900,
      "data_option": {
        "type": "text",
        "null": true,
        "translate": false
      },
      "screens": {
        "create_middle": {}
      }
    },
    {
      "name": "local_fisico",
      "object": "Ticket",
      "display": "Local de uso",
      "data_type": "select",
      "active": true,
      "editable": true,
      "position": 901,
      "data_option": {
        "options": {
          "101": "Sala 101",
          "102": "Sala 102",
          "103": "Sala 103",
          "104": "Sala 104",
          "105": "Sala 105",
          "106": "Sala 106",
          "107": "Sala 107",
          "108": "Sala 108",
          "109": "Sala 109",
          "110": "Sala 110",
          "201": "Sala 201",
          "202": "Sala 202",
          "203": "Sala 203",
          "204": "Sala 204",
          "205": "Sala 205",
          "206": "Sala 206",
          "715": "Sala 715",
          "bl1_banheiro_superior": "Bloco 1 - Banheiro Superior",
          "bl1_banheiro_terreo": "Bloco 1 - Banheiro Térreo",
          "ginasio_antigo": "Ginásio Antigo",
          "outro": "Informar no campo texto",
          "recepcao": "Recepção",
          "bib_casa_memoria": "Biblioteca - Casa da Memória"
        },
        "linktemplate": "",
        "translate": false,
        "default": "",
        "null": true,
        "relation": "",
        "nulloption": true,
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": false,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "prioridade_cliente",
      "object": "Ticket",
      "display": "Prioridade inicial",
      "data_type": "select",
      "active": true,
      "editable": true,
      "position": 902,
      "data_option": {
        "options": [
          {
            "name": "Baixa",
            "value": "1"
          },
          {
            "name": "Normal",
            "value": "2"
          },
          {
            "name": "Alta",
            "value": "3"
          },
          {
            "name": "Urgente",
            "value": "4"
          }
        ],
        "default": "2",
        "customsort": "on",
        "linktemplate": "",
        "translate": false,
        "null": true,
        "relation": "",
        "nulloption": true,
        "maxlength": 255
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": false,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "data_atendimento",
      "object": "Ticket",
      "display": "Data sugerida para atendimento",
      "data_type": "date",
      "active": true,
      "editable": true,
      "position": 903,
      "data_option": {
        "diff": null,
        "default": null,
        "null": true,
        "options": {},
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": false,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": false,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "materiais_desejados",
      "object": "Ticket",
      "display": "Materiais desejados",
      "data_type": "multiselect",
      "active": true,
      "editable": true,
      "position": 904,
      "data_option": {
        "options": {
          "banner": "banner",
          "cobertura fotográfica": "cobertura fotográfica",
          "flyer": "flyer",
          "folder": "folder",
          "postagem": "postagem",
          "video": "vídeo"
        },
        "linktemplate": "",
        "translate": false,
        "default": [],
        "null": true,
        "relation": "",
        "nulloption": true,
        "maxlength": 255,
        "multiple": true
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "orcamento_previo",
      "object": "Ticket",
      "display": "O orçamento da produção/impressão do material, precisa ser orçado previamente?",
      "data_type": "boolean",
      "active": true,
      "editable": true,
      "position": 905,
      "data_option": {
        "options": {
          "false": "não",
          "true": "sim"
        },
        "default": false,
        "translate": false,
        "null": true,
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "publico_alvo",
      "object": "Ticket",
      "display": "Quem é o público alvo?",
      "data_type": "multiselect",
      "active": true,
      "editable": true,
      "position": 906,
      "data_option": {
        "options": {
          "Alunos": "alunos",
          "colaboradores": "colaboradores",
          "comunidade": "comunidade",
          "outros": "outros (informar no texto)",
          "pais": "pais",
          "professores": "professores"
        },
        "linktemplate": "",
        "translate": false,
        "default": [],
        "null": true,
        "relation": "",
        "nulloption": true,
        "maxlength": 255,
        "multiple": true
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "data_de_uso",
      "object": "Ticket",
      "display": "Em qual data será usado?",
      "data_type": "datetime",
      "active": true,
      "editable": true,
      "position": 907,
      "data_option": {
        "future": true,
        "past": false,
        "diff": null,
        "default": null,
        "null": true,
        "options": {},
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "data_material_pronto",
      "object": "Ticket",
      "display": "Em qual data o material precisa estar pronto?",
      "data_type": "datetime",
      "active": true,
      "editable": true,
      "position": 908,
      "data_option": {
        "future": true,
        "past": false,
        "diff": null,
        "default": null,
        "null": true,
        "options": {},
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "material_referencia",
      "object": "Ticket",
      "display": "Existe algum material de referencia? Anexe no campo texto.",
      "data_type": "boolean",
      "active": true,
      "editable": true,
      "position": 909,
      "data_option": {
        "options": {
          "false": "não",
          "true": "sim"
        },
        "default": false,
        "translate": false,
        "null": true,
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "orientacao_especifica_comunicacao",
      "object": "Ticket",
      "display": "Existe alguma orientação específica de comunicação? (Texto, cores, linguagem, tamanho, identidade visual, informações obrigatórias etc.)",
      "data_type": "input",
      "active": true,
      "editable": true,
      "position": 910,
      "data_option": {
        "default": "",
        "type": "text",
        "maxlength": 200,
        "linktemplate": "",
        "null": true,
        "options": {},
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    },
    {
      "name": "data_ocorrencia",
      "object": "Ticket",
      "display": "Data da Ocorrência",
      "data_type": "datetime",
      "active": true,
      "editable": true,
      "position": 911,
      "data_option": {
        "future": false,
        "past": true,
        "diff": null,
        "default": null,
        "null": true,
        "options": {},
        "relation": ""
      },
      "screens": {
        "create_middle": {
          "ticket.customer": {
            "shown": true,
            "required": true,
            "item_class": "column"
          },
          "ticket.agent": {
            "shown": true,
            "required": true,
            "item_class": "column"
          }
        }
      }
    }
  ],
  "workflows": [
    {
      "id": 11,
      "name": "Definições para todos e ocultar campos específicos",
      "active": true,
      "object": "Ticket",
      "priority": 500,
      "stop_after_match": false,
      "preferences": {
        "screen": [
          "create_middle",
          "edit"
        ]
      },
      "condition_selected": {},
      "condition_saved": {},
      "perform": {
        "ticket.state_id": {
          "operator": "set_fixed_to",
          "set_fixed_to": [
            "1"
          ]
        },
        "ticket.priority_id": {
          "operator": "show",
          "show": "true"
        },
        "ticket.materiais_desejados": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.orcamento_previo": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.publico_alvo": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.data_de_uso": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.data_material_pronto": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.material_referencia": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.orientacao_especifica_comunicacao": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.local_fisico": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.data_atendimento": {
          "operator": "show",
          "show": "true"
        },
        "ticket.data_ocorrencia": {
          "operator": "hide",
          "hide": "true"
        }
      }
    },
    {
      "id": 12,
      "name": "Marketing Ticket - Mostrar campos exclusivos",
      "active": true,
      "object": "Ticket",
      "priority": 501,
      "stop_after_match": false,
      "preferences": {
        "screen": [
          "create_middle",
          "edit"
        ]
      },
      "condition_selected": {
        "ticket.group_id": {
          "operator": "is",
          "value": [
            "6"
          ],
          "value_completion": ""
        }
      },
      "condition_saved": {},
      "perform": {
        "ticket.materiais_desejados": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.orcamento_previo": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.publico_alvo": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.data_de_uso": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.data_material_pronto": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.material_referencia": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.orientacao_especifica_comunicacao": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.data_atendimento": {
          "operator": "hide",
          "hide": "true"
        }
      }
    },
    {
      "id": 13,
      "name": "Manutenção Ticket - Mostrar campos exclusivos",
      "active": true,
      "object": "Ticket",
      "priority": 505,
      "stop_after_match": false,
      "preferences": {
        "screen": [
          "create_middle",
          "edit"
        ]
      },
      "condition_selected": {
        "ticket.group_id": {
          "operator": "is",
          "value": [
            "1"
          ],
          "value_completion": ""
        }
      },
      "condition_saved": {},
      "perform": {
        "ticket.local_fisico": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.data_atendimento": {
          "operator": "show",
          "show": "true"
        }
      }
    },
    {
      "id": 14,
      "name": "Tecnologia Ticket - Mostrar campos exclusivos",
      "active": true,
      "object": "Ticket",
      "priority": 505,
      "stop_after_match": false,
      "preferences": {
        "screen": [
          "create_middle",
          "edit"
        ]
      },
      "condition_selected": {
        "ticket.group_id": {
          "operator": "is",
          "value": [
            "2"
          ],
          "value_completion": ""
        }
      },
      "condition_saved": {},
      "perform": {
        "ticket.local_fisico": {
          "operator": [
            "show",
            "set_mandatory"
          ],
          "show": "true",
          "set_mandatory": "true"
        },
        "ticket.data_atendimento": {
          "operator": "show",
          "show": "true"
        }
      }
    },
    {
      "id": 15,
      "name": "Registro de Ocorrência - Ticket",
      "active": true,
      "object": "Ticket",
      "priority": 504,
      "stop_after_match": false,
      "preferences": {
        "screen": [
          "create_middle",
          "edit"
        ]
      },
      "condition_selected": {
        "ticket.group_id": {
          "operator": "is",
          "value": [
            "13"
          ],
          "value_completion": ""
        }
      },
      "condition_saved": {},
      "perform": {
        "ticket.prioridade_cliente": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.data_atendimento": {
          "operator": "hide",
          "hide": "true"
        },
        "ticket.data_ocorrencia": {
          "operator": "show",
          "show": "true"
        }
      }
    },
    {
      "id": 16,
      "name": "Ocultar alteração de Estado para clientes",
      "active": true,
      "object": "Ticket",
      "priority": 499,
      "stop_after_match": false,
      "preferences": {
        "screen": []
      },
      "condition_selected": {
        "session.role_ids": {
          "operator": "is not",
          "value": [
            "1",
            "5",
            "2",
            "4",
            "6",
            "9",
            "8",
            "7"
          ]
        }
      },
      "condition_saved": {},
      "perform": {
        "ticket.state_id": {
          "operator": "hide",
          "hide": "true"
        }
      }
    }
  ],
  "fetchedAt": "2026-11-10T00:00:00.000Z"
};
