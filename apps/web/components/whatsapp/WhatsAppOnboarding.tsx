"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Smartphone, Bell } from "lucide-react";
import { WhatsAppIllustration } from "./WhatsAppIllustration";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    aria-label="WhatsApp" 
    role="img" 
    viewBox="0 0 512 512" 
    fill="#000000"
    className={className}
  >
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
      <rect width="512" height="512" rx="15%" fill="#6ACB76"></rect>
      <path fill="#6ACB76" stroke="#ffffff" strokeWidth="26" d="M123 393l14-65a138 138 0 1150 47z"></path>
      <path fill="#ffffff" d="M308 273c-3-2-6-3-9 1l-12 16c-3 2-5 3-9 1-15-8-36-17-54-47-1-4 1-6 3-8l9-14c2-2 1-4 0-6l-12-29c-3-8-6-7-9-7h-8c-2 0-6 1-10 5-22 22-13 53 3 73 3 4 23 40 66 59 32 14 39 12 48 10 11-1 22-10 27-19 1-3 6-16 2-18"></path>
    </g>
  </svg>
);

interface WhatsAppOnboardingProps {
  onConnect: () => void | Promise<void>;
  isLoading?: boolean;
}

export function WhatsAppOnboarding({ onConnect, isLoading = false }: WhatsAppOnboardingProps) {
  const steps = [
    {
      number: 1,
      icon: QrCode,
      title: "Escanear QR Code",
      description: "Use seu celular para escanear o QR Code exibido.",
    },
    {
      number: 2,
      icon: Smartphone,
      title: "Manter seu dispositivo online",
      description: "Mantenha o WhatsApp conectado e ativo no seu celular.",
    },
    {
      number: 3,
      icon: Bell,
      title: "Permitir notificações",
      description: "Ative as notificações para receber alertas importantes.",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-8 md:py-12 px-4">
      <Card className="w-full max-w-5xl border shadow-lg bg-card">
        <CardContent className="p-6 md:p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left side - Content */}
            <div className="space-y-6 md:space-y-8 order-2 lg:order-1">
              {/* WhatsApp Icon and Title */}
              <div className="space-y-4">
                <div className="flex items-center justify-center lg:justify-start">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center overflow-hidden">
                    <WhatsAppIcon className="w-full h-full" />
                  </div>
                </div>
                
                <div className="text-center lg:text-left">
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-2 md:mb-3">
                    Conectar WhatsApp
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base lg:text-lg leading-relaxed">
                    Conecte seu WhatsApp para enviar mensagens e automatizar atendimentos.
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-5 md:space-y-6">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.number}
                      className="flex items-start gap-3 md:gap-4"
                    >
                      {/* Step number circle */}
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs md:text-sm shadow-sm">
                          {step.number}
                        </div>
                      </div>
                      
                      {/* Step content */}
                      <div className="flex-1 space-y-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <h3 className="font-medium text-sm md:text-base">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTA Button */}
              <div className="pt-2 md:pt-4">
                <Button
                  onClick={onConnect}
                  disabled={isLoading}
                  size="lg"
                  className="w-full md:w-auto md:min-w-[240px] text-base h-12 md:h-14 px-6 md:px-8 shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="w-5 h-5 mr-2 flex items-center justify-center">
                    <WhatsAppIcon className="w-full h-full" />
                  </div>
                  {isLoading ? "Conectando..." : "Conectar WhatsApp"}
                </Button>
              </div>
            </div>

            {/* Right side - Illustration */}
            <div className="order-1 lg:order-2 flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-sm lg:max-w-md">
                <WhatsAppIllustration className="w-full h-auto opacity-90" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

