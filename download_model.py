import torch
from transformers import AutoModel, AutoTokenizer

# Load the LaBSE model and tokenizer
model_name = "sentence-transformers/LaBSE"
model = AutoModel.from_pretrained(model_name)
model.eval()

# Create dummy input
dummy_input = torch.randint(0, 1000, (1, 64))  # Example input size (batch_size=1, sequence_length=64)

# Trace the model, extracting the 'last_hidden_state' tensor
def forward_pass(input_ids):
    outputs = model(input_ids)
    return outputs.last_hidden_state  # Return the tensor (instead of the full dictionary)

# Trace the model with the custom forward pass
traced_model = torch.jit.trace(forward_pass, (dummy_input,))
traced_model.save("LaBSE_traced.pt")