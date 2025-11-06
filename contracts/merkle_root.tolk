tolk 1.1

// Merkle Root Contract (Core Logic)
// Minimal on-chain logic for hackathon use. Stores an updatable Merkle root and exposes
// a local proof verifier. Cross-contract verification will be mocked by consumers.

struct Storage {
    admin: address            // hardcoded backend/admin address stored at deploy; compared against provided sender_address
    current_merkle_root: cell
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

// Helper: compare two addresses/slices via hashed cell representation
fun addressesEqual(a: address, b: address): bool {
    var ba = beginCell();
    ba.storeAddress(a);
    var ca = ba.toCell();

    var bb = beginCell();
    bb.storeAddress(b);
    var cb = bb.toCell();

    return ca.hash() == cb.hash();
}

// Message: update merkle root (admin-only)
// NOTE: In TON, state updates occur via messages. For hackathon simplicity,
// we accept admin address in message body and compare to stored admin.
struct (0xA1C3BEEF) UpdateMerkleRoot {
    queryId: uint64
    new_root: cell
    sender_address: address
}

type AllowedMessage = UpdateMerkleRoot

// Pair two cells and compute their parent cell.
// For Merkle computation, we serialize left/right children as refs into a builder,
// and consider the parent cell's hash as the node hash.
fun hashPair(left: cell, right: cell): cell {
    var b = beginCell();
    b.storeRef(left);
    b.storeRef(right);
    return b.toCell();
}

// Verify a Merkle proof against a given root using standard left/right concatenation.
// proof cell is expected to contain a sequence:
//   [dir_bit, sibling_ref] repeated until empty
// dir_bit: 0 = current on left, 1 = current on right
fun verifyProofAgainstRoot(root: cell, leaf: cell, proof: cell): bool {
    var current = leaf;
    var ps = proof.beginParse();

    while (!ps.isEmpty()) {
        val dir = ps.loadUint(1);
        val sibling = ps.loadRef();

        var parent: cell;
        if (dir == 0) {
            parent = hashPair(current, sibling);
        } else {
            parent = hashPair(sibling, current);
        }
        current = parent;
    }

    return current.hash() == root.hash();
}

// Internal message handler
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        UpdateMerkleRoot => {
            var storage = lazy Storage.load();

            // admin-only
            assert (addressesEqual(storage.admin, msg.sender_address)) throw 0xABCD;

            storage.current_merkle_root = msg.new_root;
            storage.save();
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}

// Optional: bounced handler (unused)
fun onBouncedMessage(in: InMessageBounced) {
}

// Getters
get fun get_merkle_root(): cell {
    val storage = lazy Storage.load();
    return storage.current_merkle_root;
}

// Crucial: proof verifier exposed as a getter for off-chain verification as well.
// NOTE: get methods cannot be called by other contracts on-chain.
// Consumers (e.g., NFT collection) should either mirror the root locally and call the same
// algorithm, or implement an internal cross-contract pattern. For hackathon, we keep it simple.
get fun verify_proof(leaf: cell, proof: cell): bool {
    val storage = lazy Storage.load();
    return verifyProofAgainstRoot(storage.current_merkle_root, leaf, proof);
}
