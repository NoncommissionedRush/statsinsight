"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeAnalysisModule = void 0;
const common_1 = require("@nestjs/common");
const cache_module_1 = require("../cache/cache.module");
const trade_analysis_controller_1 = require("./trade-analysis.controller");
const trade_analysis_service_1 = require("./trade-analysis.service");
let TradeAnalysisModule = class TradeAnalysisModule {
};
exports.TradeAnalysisModule = TradeAnalysisModule;
exports.TradeAnalysisModule = TradeAnalysisModule = __decorate([
    (0, common_1.Module)({
        imports: [cache_module_1.CacheModule],
        controllers: [trade_analysis_controller_1.TradeAnalysisController],
        providers: [trade_analysis_service_1.TradeAnalysisService],
        exports: [trade_analysis_service_1.TradeAnalysisService],
    })
], TradeAnalysisModule);
//# sourceMappingURL=trade-analysis.module.js.map