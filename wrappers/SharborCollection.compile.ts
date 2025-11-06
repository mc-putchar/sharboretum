import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/sharbor_collection.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
