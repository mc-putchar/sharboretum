tolk 1.1

// SHARD Jetton Master (TEP-74, minimal mintable version for hackathon)
// Storage tracks admin, total supply, wallet code cell, and jetton content.
// Minting credits a user's Jetton Wallet (mocked deploy + address derivation).
//
// NOTE: For a full TEP-74 implementation you would:
// - Deploy per-user Jetton Wallet contracts with StateInit (code+data)
// - Send internal messages to wallets to update balances and perform transfers
// - Implement fees, burns, and standardized get methods
// This file focuses on essential minting logic and deterministic wallet address derivation.

struct Storage {
    admin: address
    total_supply: uint128
    wallet_code: cell
    content: cell
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
    val ca = ba.toCell();

    var bb = beginCell();
    bb.storeAddress(b);
    val cb = bb.toCell();

    return ca.hash() == cb.hash();
}

// Build wallet init data cell for a user's Jetton Wallet.
// Minimal layout: (master_address, owner_address)
// In full spec, wallet storage includes balance, possibly custom fields, etc.
// Address derivation must depend ONLY on master and owner to keep wallet address stable.
fun buildWalletInitData(master: address, owner: address): cell {
    var b = beginCell();
    b.storeAddress(master);
    b.storeAddress(owner);
    return b.toCell();
}

// Compute deterministic wallet address from wallet code and init data.
// This mimics address derivation by hashing code+data (workchain omitted for simplicity).
fun computeWalletAddress(code: cell, data: cell): address {
    var bb = beginCell();
    bb.storeRef(code);
    bb.storeRef(data);
    val comp = bb.endCell();
    val h = comp.hash();
    // Encode 256-bit hash into a slice (pseudo-address for demos)
    var s = beginCell();
    s.storeUint(h, 256);
    return s.endCell().beginParse().loadAddress();
}

// Mock deploy function: in production you'd send StateInit (code+data) and an internal message.
// For hackathon we just compute the address and assume wallet exists or is created off-chain.
fun mockDeployWallet(code: cell, data: cell): address {
    return computeWalletAddress(code, data);
}

// Administrative updates
struct (0x74D90001) UpdateWalletCode {
    queryId: uint64
    new_wallet_code: cell
    sender_address: address
}

struct (0x74D90002) UpdateJettonContent {
    queryId: uint64
    new_content: cell
    sender_address: address
}

// Mint SHARD tokens to a user's Jetton Wallet (admin-only)
struct (0x74D9A001) MintShard {
    queryId: uint64
    to_address: address
    amount: uint128
    sender_address: address
}

type AllowedMessage = UpdateWalletCode | UpdateJettonContent | MintShard

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        UpdateWalletCode => {
            var s = lazy Storage.load();
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0x7401;
            s.wallet_code = msg.new_wallet_code;
            s.save();
        }

        UpdateJettonContent => {
            var s = lazy Storage.load();
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0x7402;
            s.content = msg.new_content;
            s.save();
        }

        MintShard => {
            var s = lazy Storage.load();
            // Admin gate
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0x74A1;

            // Derive pseudo master address from current data for wallet init
            var selfAddrDeriveB = beginCell();
            selfAddrDeriveB.storeRef(contract.getData());
            val pseudoMasterAddr = selfAddrDeriveB.endCell().beginParse().loadAddress();

            // Build wallet init data and (mock) deploy/get address
            val initData = buildWalletInitData(pseudoMasterAddr, msg.to_address);
            val walletAddr = mockDeployWallet(s.wallet_code, initData);

            // Increase total supply
            s.total_supply = s.total_supply + msg.amount;
            s.save();

            // In a full implementation, send an internal message to walletAddr to credit `amount`
            // and optionally attach notification. For hackathon we omit actual cross-contract call.
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {
}

// Getters following Jetton expectations (minimal):
// Return: total_supply, admin, content, wallet_code
get fun get_jetton_data(): (int, address, cell, cell) {
    val s = lazy Storage.load();
    return (s.total_supply, s.admin, s.content, s.wallet_code);
}

// Deterministic wallet address for an owner
get fun get_wallet_address(owner: address): address {
    val s = lazy Storage.load();
    var selfAddrDeriveB = beginCell();
    selfAddrDeriveB.storeRef(contract.getData());
    val pseudoMasterAddr = selfAddrDeriveB.endCell().beginParse().loadAddress();

    val initData = buildWalletInitData(pseudoMasterAddr, owner);
    return computeWalletAddress(s.wallet_code, initData);
}
